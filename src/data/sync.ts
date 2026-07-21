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
    mode: row.mode,
    started_at: new Date(row.startedAt).toISOString(),
    ended_at: row.endedAt ? new Date(row.endedAt).toISOString() : null,
    duration_sec: row.durationSec,
    score: row.score,
    total_attempts: row.totalAttempts ?? 0,
    correct: row.correct ?? 0,
    errors: row.errors ?? 0,
    accuracy: row.accuracy ?? null,
    median_ms: row.medianMs ?? null,
    focus: row.focus ?? [],
    seed: row.seed ?? null,
    config: row.config,
    app_version: row.appVersion ?? null,
    platform: row.platform ?? null,
    user_agent: row.userAgent ?? null,
    local_hour: row.localHour ?? null,
    timezone: row.timezone ?? null,
  };
}

function toAttemptInsert(row: AttemptRow, userId: string) {
  return {
    id: row.id,
    session_id: row.sessionId,
    user_id: userId,
    idx: row.idx ?? 0,
    op: row.op,
    operand_a: row.operands[0],
    operand_b: row.operands[1],
    answer: row.answer,
    given: row.given,
    correct: row.correct,
    time_ms: row.timeMs,
    first_input_ms: row.firstInputMs ?? null,
    corrections: row.corrections,
    answer_digits: row.answerDigits ?? null,
    prompt: row.prompt ?? null,
    bucket: row.bucket,
    targeted: row.targeted ?? false,
    ts: new Date(row.ts).toISOString(),
  };
}

export async function pushPending(): Promise<void> {
  if (!supabase || pushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  pushing = true;
  try {
    const pendingSessions = await db.sessions.where('synced').equals(0).toArray();
    const pendingAttempts = await db.attempts.where('synced').equals(0).toArray();
    const settings = await db.settings.get('local');
    const settingsPending = settings?.synced === 0;
    const hasPending = pendingSessions.length > 0 || pendingAttempts.length > 0 || settingsPending;

    let userId = await currentUserId();
    if (!userId) {
      // Only mint an (anonymous) account when there's actually data to store —
      // opening the app or browsing never creates one.
      if (!hasPending) return;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) return;
      userId = data.user.id;
    }

    // Backfill any local rows created before this account existed, then push.
    if (pendingSessions.length) {
      const payload = pendingSessions.map((s) => toSessionInsert(s, userId!));
      const { error } = await supabase.from('sessions').upsert(payload, { onConflict: 'id' });
      if (!error) {
        await db.transaction('rw', db.sessions, async () => {
          for (const s of pendingSessions) await db.sessions.update(s.id, { synced: 1, userId });
        });
      }
    }

    if (pendingAttempts.length) {
      const payload = pendingAttempts.map((a) => toAttemptInsert(a, userId!));
      const { error } = await supabase.from('attempts').upsert(payload, { onConflict: 'id' });
      if (!error) {
        await db.transaction('rw', db.attempts, async () => {
          for (const a of pendingAttempts) await db.attempts.update(a.id, { synced: 1, userId });
        });
      }
    }

    // Push local settings. Send updated_at explicitly (an onConflict update
    // does NOT re-fire the column default), so cross-device "newer wins"
    // compares consistent client-origin timestamps.
    if (settings && settingsPending) {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          config: settings.config,
          goal_score: settings.goalScore,
          updated_at: new Date(settings.updatedAt || Date.now()).toISOString(),
        },
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

/* ------------------------------------------------------------------ pull */

interface RemoteSession {
  id: string;
  user_id: string;
  mode: SessionRow['mode'];
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  score: number;
  total_attempts: number;
  correct: number;
  errors: number;
  accuracy: number | null;
  median_ms: number | null;
  focus: string[] | null;
  seed: number | null;
  config: SessionRow['config'];
  app_version: string | null;
  platform: string | null;
  user_agent: string | null;
  local_hour: number | null;
  timezone: string | null;
}

interface RemoteAttempt {
  id: string;
  session_id: string;
  user_id: string;
  idx: number;
  op: AttemptRow['op'];
  operand_a: number;
  operand_b: number;
  answer: number;
  given: number | null;
  correct: boolean;
  time_ms: number;
  first_input_ms: number | null;
  corrections: number;
  answer_digits: number | null;
  prompt: string | null;
  bucket: string;
  targeted: boolean;
  ts: string;
}

function fromRemoteSession(r: RemoteSession): SessionRow {
  return {
    id: r.id,
    userId: r.user_id,
    mode: r.mode,
    startedAt: Date.parse(r.started_at),
    endedAt: r.ended_at ? Date.parse(r.ended_at) : Date.parse(r.started_at),
    durationSec: r.duration_sec,
    score: r.score,
    totalAttempts: r.total_attempts ?? 0,
    correct: r.correct ?? 0,
    errors: r.errors ?? 0,
    accuracy: r.accuracy ?? 0,
    medianMs: r.median_ms ?? 0,
    focus: r.focus ?? [],
    seed: r.seed ?? null,
    config: r.config,
    appVersion: r.app_version ?? '',
    platform: r.platform ?? '',
    userAgent: r.user_agent ?? '',
    localHour: r.local_hour ?? -1,
    timezone: r.timezone ?? '',
    synced: 1,
  };
}

function fromRemoteAttempt(r: RemoteAttempt): AttemptRow {
  return {
    id: r.id,
    sessionId: r.session_id,
    userId: r.user_id,
    idx: r.idx ?? 0,
    op: r.op,
    operands: [r.operand_a, r.operand_b],
    answer: r.answer,
    given: r.given,
    correct: r.correct,
    timeMs: r.time_ms,
    firstInputMs: r.first_input_ms ?? null,
    corrections: r.corrections ?? 0,
    answerDigits: r.answer_digits ?? String(r.answer).length,
    prompt: r.prompt ?? '',
    bucket: r.bucket,
    targeted: r.targeted ?? false,
    ts: Date.parse(r.ts),
    synced: 1,
  };
}

let pulling = false;

/**
 * Download this account's cloud history into the local store. Runs on login so
 * a fresh device / cleared browser gets its full history back. Rows are keyed
 * by UUID and immutable, so bulkPut merges cleanly with any local data.
 */
export async function pullAll(): Promise<void> {
  if (!supabase || pulling || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const userId = await currentUserId();
  if (!userId) return;

  pulling = true;
  try {
    const PAGE = 1000;

    // Sessions — paged (a heavy user can exceed PostgREST's 1000-row cap).
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      await db.sessions.bulkPut(data.map((s) => fromRemoteSession(s as RemoteSession)));
      if (data.length < PAGE) break;
    }

    // Attempts can be many — page through in chunks.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', userId)
        .order('ts', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      await db.attempts.bulkPut(data.map((a) => fromRemoteAttempt(a as RemoteAttempt)));
      if (data.length < PAGE) break;
    }

    // Settings: adopt the cloud copy if it's newer than local — but never
    // clobber an unpushed local change (synced === 0).
    const { data: remoteSettings } = await supabase
      .from('user_settings')
      .select('config, goal_score, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (remoteSettings) {
      const local = await db.settings.get('local');
      const remoteAt = remoteSettings.updated_at ? Date.parse(remoteSettings.updated_at) : 0;
      const localPending = local?.synced === 0;
      if (!localPending && (!local || remoteAt > local.updatedAt)) {
        await db.settings.put({
          id: 'local',
          config: remoteSettings.config,
          goalScore: remoteSettings.goal_score,
          updatedAt: remoteAt,
          synced: 1,
        });
      }
    }
  } catch {
    // best-effort; a later login/foreground retries
  } finally {
    pulling = false;
  }
}

/**
 * Re-flag all local rows as unsynced so the next push re-uploads them under
 * whatever account is now signed in. Used when an anonymous user signs into an
 * existing account, so their local history migrates instead of being orphaned.
 */
export async function markAllUnsynced(): Promise<void> {
  await db.transaction('rw', db.sessions, db.attempts, db.settings, async () => {
    await db.sessions.toCollection().modify({ synced: 0 });
    await db.attempts.toCollection().modify({ synced: 0 });
    const s = await db.settings.get('local');
    if (s) await db.settings.update('local', { synced: 0 });
  });
}

/**
 * Delete a session (and its attempts, via FK cascade) from the cloud. Used
 * when discarding an interrupted run. Best-effort; RLS scopes it to the owner.
 */
export async function deleteRemoteSession(id: string): Promise<void> {
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await supabase.from('sessions').delete().eq('id', id).eq('user_id', userId);
  } catch {
    // best-effort; the local copy is already gone
  }
}

/**
 * Permanently delete the signed-in account: its cloud data + auth user (via the
 * `delete-account` Edge Function, which runs with the service role), then wipe
 * every local table so nothing lingers on this device. Returns null on success
 * or an error message. Required for App Store account-deletion compliance.
 */
export async function deleteAccountData(): Promise<string | null> {
  if (!supabase) return 'Cloud sync is not configured.';
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) return error.message || 'Could not delete your account. Please try again.';
  await db.transaction('rw', db.sessions, db.attempts, db.settings, async () => {
    await db.sessions.clear();
    await db.attempts.clear();
    await db.settings.clear();
  });
  return null;
}

/** Fire-and-forget; safe to call after every session finish. */
export function triggerSync(): void {
  void pushPending();
}

/** Push local changes up, then pull anything new down. Use on login. */
export function syncBoth(): void {
  void pushPending().then(() => pullAll());
}

/** Wire up automatic sync on regaining connectivity / app foreground. */
export function installSyncListeners(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', triggerSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerSync();
  });
}
