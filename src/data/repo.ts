import { db, type AttemptRow, type SessionRow, type SettingsRow } from './db';
import { DEFAULT_CONFIG, DEFAULT_GOAL_SCORE, cloneConfig } from '../engine/config';
import type { Attempt, GameConfig } from '../engine/types';

/** Persist a finished session and its attempts locally (source of truth). */
export async function saveSession(
  session: Omit<SessionRow, 'synced' | 'userId'>,
  attempts: Attempt[],
  userId: string | null,
): Promise<void> {
  const sessionRow: SessionRow = { ...session, userId, synced: 0 };
  const attemptRows: AttemptRow[] = attempts.map((a) => ({ ...a, userId, synced: 0 }));
  await db.transaction('rw', db.sessions, db.attempts, async () => {
    await db.sessions.put(sessionRow);
    if (attemptRows.length) await db.attempts.bulkPut(attemptRows);
  });
}

export async function getAllAttempts(): Promise<AttemptRow[]> {
  return db.attempts.toArray();
}

export async function getAllSessions(): Promise<SessionRow[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

export async function getBestScore(mode?: SessionRow['mode']): Promise<number> {
  const sessions = await db.sessions.toArray();
  const pool = mode ? sessions.filter((s) => s.mode === mode) : sessions;
  return pool.reduce((best, s) => Math.max(best, s.score), 0);
}

export async function getSettings(): Promise<SettingsRow> {
  const existing = await db.settings.get('local');
  if (existing) return existing;
  const fresh: SettingsRow = {
    id: 'local',
    config: cloneConfig(DEFAULT_CONFIG),
    goalScore: DEFAULT_GOAL_SCORE,
    updatedAt: 0,
    synced: 0,
  };
  await db.settings.put(fresh);
  return fresh;
}

export async function saveSettings(config: GameConfig, goalScore: number): Promise<void> {
  const row: SettingsRow = {
    id: 'local',
    config,
    goalScore,
    updatedAt: nowMs(),
    synced: 0,
  };
  await db.settings.put(row);
}

function nowMs(): number {
  return Date.now();
}
