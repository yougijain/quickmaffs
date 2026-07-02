import { db, type AttemptRow, type SessionRow } from './db';
import { supabase } from './supabase';

/**
 * Local-first sync. Writes always land in Dexie first (synced=0). This pushes
 * anything pending to Supabase when authenticated + online, using client-side
 * UUIDs so inserts are idempotent (upsert on id). Rows are append-only, so a
 * merge across devices is conflict-free.
 */

let pushing = false;

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toSessionInsert(row: SessionRow, userId: string) {
  return {
    id: row.id,
    user_id: userId,
    started_at: new Date(row.startedAt).toISOString(),
    duration_sec: row.durationSec,
    score: row.score,
    mode: row.mode,
    config: row.config,
  };
}

function toAttemptInsert(row: AttemptRow, userId: string) {
  return {
    id: row.id,
    session_id: row.sessionId,
    user_id: userId,
    op: row.op,
    operand_a: row.operands[0],
    operand_b: row.operands[1],
    answer: row.answer,
    given: row.given,
    correct: row.correct,
    time_ms: row.timeMs,
    corrections: row.corrections,
    bucket: row.bucket,
    ts: new Date(row.ts).toISOString(),
  };
}

export async function pushPending(): Promise<void> {
  if (!supabase || pushing || typeof navigator !== 'undefined' && !navigator.onLine) return;
  const userId = await currentUserId();
  if (!userId) return;

  pushing = true;
  try {
    // Backfill any local rows created while anonymous, then push.
    const pendingSessions = await db.sessions.where('synced').equals(0).toArray();
    if (pendingSessions.length) {
      const payload = pendingSessions.map((s) => toSessionInsert(s, userId));
      const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' });
      if (!error) {
        await db.transaction('rw', db.sessions, async () => {
          for (const s of pendingSessions) await db.sessions.update(s.id, { synced: 1, userId });
        });
      }
    }

    const pendingAttempts = await db.attempts.where('synced').equals(0).toArray();
    if (pendingAttempts.length) {
      const payload = pendingAttempts.map((a) => toAttemptInsert(a, userId));
      const { error } = await supabase.from('attempts').upsert(payload, { onConflict: 'id' });
      if (!error) {
        await db.transaction('rw', db.attempts, async () => {
          for (const a of pendingAttempts) await db.attempts.update(a.id, { synced: 1, userId });
        });
      }
    }

    // Push local settings (mutable — resolved by updated_at server-side).
    const settings = await db.settings.get('local');
    if (settings && settings.synced === 0) {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: userId, config: settings.config, goal_score: settings.goalScore },
          { onConflict: 'user_id' },
        );
      if (!error) await db.settings.update('local', { synced: 1 });
    }
  } catch {
    // Network/other failure: leave rows pending; a later trigger retries.
  } finally {
    pushing = false;
  }
}

/** Fire-and-forget; safe to call after every session finish. */
export function triggerSync(): void {
  void pushPending();
}

/** Wire up automatic sync on regaining connectivity / app foreground. */
export function installSyncListeners(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', triggerSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerSync();
  });
}
