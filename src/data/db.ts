import Dexie, { type Table } from 'dexie';
import type { Attempt, GameConfig, SessionMode } from '../engine/types';

export interface SessionRow {
  id: string;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  durationSec: number;
  score: number;
  mode: SessionMode;
  totalAttempts: number;
  correct: number;
  errors: number;
  accuracy: number; // correct / totalAttempts, 0..1
  medianMs: number;
  focus: string[]; // targeted bucket keys (adaptive/drill)
  seed: number | null;
  config: GameConfig;
  appVersion: string;
  platform: string;
  userAgent: string;
  localHour: number;
  timezone: string;
  userId: string | null;
  synced: 0 | 1;
}

export interface AttemptRow extends Attempt {
  userId: string | null;
  synced: 0 | 1;
}

export interface SettingsRow {
  id: 'local';
  config: GameConfig;
  goalScore: number;
  updatedAt: number;
  synced: 0 | 1;
}

class QuickMaffsDB extends Dexie {
  sessions!: Table<SessionRow, string>;
  attempts!: Table<AttemptRow, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('quickmaffs');
    this.version(1).stores({
      sessions: 'id, synced, startedAt, mode',
      attempts: 'id, sessionId, bucket, synced, ts',
      settings: 'id',
    });
  }
}

export const db = new QuickMaffsDB();
