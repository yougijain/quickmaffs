import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SettingsRow } from './db';
import { DEFAULT_CONFIG, DEFAULT_GOAL_SCORE, cloneConfig } from '../engine/config';
import { aggregate, globalMedianMs, median } from '../analytics/aggregate';
import { MIN_SAMPLES, rankWeaknesses } from '../analytics/weakness';
import { buildAdaptivePlan, type AdaptivePlan } from '../analytics/adaptive';
import type { Operation } from '../engine/types';

const DEFAULT_SETTINGS: SettingsRow = {
  id: 'local',
  config: cloneConfig(DEFAULT_CONFIG),
  goalScore: DEFAULT_GOAL_SCORE,
  updatedAt: 0,
  synced: 0,
};

// Read-only: never write inside a liveQuery observation context. The stored
// row is seeded once at startup (see ensureSettings); until then we fall back
// to defaults in-memory.
export function useSettings(): SettingsRow {
  const row = useLiveQuery(() => db.settings.get('local'), []);
  return row ?? DEFAULT_SETTINGS;
}

export function useSessions() {
  return useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), []);
}

/** Best BENCHMARK score — 120s classic runs only, so it stays comparable to
 *  the Zetamac tiers/percentile. Training-session scores don't count here. */
export function useBestScore() {
  return useLiveQuery(async () => {
    const sessions = await db.sessions.toArray();
    return sessions
      .filter((s) => s.mode === 'classic' && s.durationSec === 120)
      .reduce((best, s) => Math.max(best, s.score), 0);
  }, []);
}

/**
 * Benchmark summary over 120s classic runs: best (drives rank), and average
 * (your consistency — this is what needs to hit the interview-ready bar, not
 * just your one-off top score).
 */
export function useBenchmarkStats() {
  return useLiveQuery(async () => {
    const runs = (await db.sessions.toArray()).filter((s) => s.mode === 'classic' && s.durationSec === 120);
    const best = runs.reduce((m, s) => Math.max(m, s.score), 0);
    const average = runs.length ? Math.round(runs.reduce((sum, s) => sum + s.score, 0) / runs.length) : 0;
    return { best, average, count: runs.length };
  }, []);
}

/**
 * Live adaptive plan for the next training session. Recomputes whenever
 * attempts are saved, so it always reflects the just-finished session.
 */
export function useAdaptivePlan(): AdaptivePlan | undefined {
  const settings = useSettings();
  return useLiveQuery(async () => {
    const attempts = await db.attempts.toArray();
    return buildAdaptivePlan(attempts, settings.config);
  }, [settings.config]);
}

/** Aggregated weakness ranking across all recorded attempts. */
export function useWeaknesses(limit = 5) {
  return useLiveQuery(async () => {
    const attempts = await db.attempts.toArray();
    const stats = aggregate(attempts);
    const g = globalMedianMs(attempts);
    return { ranked: rankWeaknesses(stats, g, limit), stats, globalMedianMs: g, total: attempts.length };
  }, [limit]);
}

export interface OpStat {
  n: number;
  medianMs: number;
  errorRate: number;
  /** Simple 0+ weakness signal: relative slowness vs. your own overall pace,
   *  plus error rate. Not intrinsic-difficulty-normalized — this is a plain
   *  "which of MY ops takes longest" comparison, deliberately simple. */
  level: 'neutral' | 'calm' | 'warn' | 'weak';
}

/**
 * Per-operation timing/error rollup across all logged attempts, plus your
 * overall median pace (used as the "Pace" stat — a much steadier signal than
 * accuracy, since auto-advance means almost every attempt is "correct" and
 * only the buzzer-caught problem ever isn't).
 */
export function useOpStats() {
  return useLiveQuery(async () => {
    const attempts = await db.attempts.toArray();
    const byOp: Partial<Record<Operation, { correctTimes: number[]; n: number; errors: number }>> = {};
    const allCorrectTimes: number[] = [];
    for (const a of attempts) {
      const b = (byOp[a.op] ??= { correctTimes: [], n: 0, errors: 0 });
      b.n++;
      if (a.correct) {
        b.correctTimes.push(a.timeMs);
        allCorrectTimes.push(a.timeMs);
      } else {
        b.errors++;
      }
    }
    const overallMedianMs = median(allCorrectTimes);
    const ops: Partial<Record<Operation, OpStat>> = {};
    for (const op of Object.keys(byOp) as Operation[]) {
      const b = byOp[op]!;
      const medianMsOp = median(b.correctTimes);
      const errorRate = b.n ? b.errors / b.n : 0;
      let level: OpStat['level'] = 'neutral';
      if (b.n >= MIN_SAMPLES) {
        const slowPenalty = overallMedianMs > 0 ? Math.max(0, medianMsOp / overallMedianMs - 1) : 0;
        const score = slowPenalty + errorRate * 2;
        level = score > 0.4 || errorRate > 0.15 ? 'weak' : score > 0.15 ? 'warn' : 'calm';
      }
      ops[op] = { n: b.n, medianMs: medianMsOp, errorRate, level };
    }
    return { ops, overallMedianMs };
  }, []);
}
