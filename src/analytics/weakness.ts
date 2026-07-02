import type { BucketStat } from './aggregate';

/** Minimum attempts in a bucket before we trust its signal. */
export const MIN_SAMPLES = 5;

export interface WeaknessRank {
  stat: BucketStat;
  score: number; // higher = weaker
  slowness: number; // medianMs / globalMedianMs
}

/**
 * Weakness score blends relative slowness and error rate. A bucket with too
 * few samples scores 0 (no signal). Errors are weighted more heavily than
 * slowness because a wrong answer is costlier than a slow one.
 */
export function weaknessScore(stat: BucketStat, globalMedianMs: number): number {
  if (stat.n < MIN_SAMPLES) return 0;
  const g = globalMedianMs || 1;
  const slowness = stat.medianMs / g;
  const slowPenalty = Math.max(0, slowness - 1); // only slower-than-average counts
  return slowPenalty * 1.0 + stat.errorRate * 2.0;
}

/** Rank buckets from weakest to strongest, dropping low-signal buckets. */
export function rankWeaknesses(stats: BucketStat[], globalMedianMs: number, limit = 5): WeaknessRank[] {
  const g = globalMedianMs || 1;
  return stats
    .map((stat) => ({
      stat,
      score: weaknessScore(stat, globalMedianMs),
      slowness: stat.medianMs / g,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
