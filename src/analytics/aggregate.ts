import { bucketLabel, opOfBucket } from '../engine/buckets';
import type { Attempt, Operation } from '../engine/types';

export interface BucketStat {
  bucket: string;
  label: string;
  op: Operation;
  n: number;
  errors: number;
  errorRate: number;
  medianMs: number;
  p90Ms: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Median time-to-answer across all *correct* attempts (the reference pace). */
export function globalMedianMs(attempts: Attempt[]): number {
  const times = attempts.filter((a) => a.correct).map((a) => a.timeMs);
  return median(times);
}

/** Group attempts by bucket and compute timing + error stats. */
export function aggregate(attempts: Attempt[]): BucketStat[] {
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const arr = groups.get(a.bucket) ?? [];
    arr.push(a);
    groups.set(a.bucket, arr);
  }

  const stats: BucketStat[] = [];
  for (const [bucket, arr] of groups) {
    // Timing uses correct attempts (a wrong/unfinished answer's time is noise).
    const times = arr
      .filter((a) => a.correct)
      .map((a) => a.timeMs)
      .sort((x, y) => x - y);
    const errors = arr.filter((a) => !a.correct).length;
    stats.push({
      bucket,
      label: bucketLabel(bucket),
      op: opOfBucket(bucket),
      n: arr.length,
      errors,
      errorRate: arr.length ? errors / arr.length : 0,
      medianMs: percentile(times, 0.5),
      p90Ms: percentile(times, 0.9),
    });
  }
  return stats;
}
