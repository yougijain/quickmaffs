import { describe, expect, it } from 'vitest';
import { aggregate, globalMedianMs, median } from './aggregate';
import { rankWeaknesses, weaknessScore, MIN_SAMPLES } from './weakness';
import { buildFocusDrill } from './drills';
import { DEFAULT_CONFIG } from '../engine/config';
import { bucketOf } from '../engine/buckets';
import type { Attempt } from '../engine/types';

function attempt(op: Attempt['op'], operands: [number, number], timeMs: number, correct = true): Attempt {
  return {
    id: Math.random().toString(36),
    sessionId: 's',
    op,
    operands,
    answer: 0,
    given: correct ? 0 : 1,
    correct,
    timeMs,
    corrections: 0,
    bucket: bucketOf({ op, operands }),
    ts: 0,
  };
}

describe('aggregate + weakness', () => {
  it('median works for odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // rounded (2+3)/2 = 2.5 -> 3
  });

  it('identifies a slow bucket as weak', () => {
    const attempts: Attempt[] = [];
    // fast baseline: lots of quick adds
    for (let i = 0; i < 20; i++) attempts.push(attempt('add', [30, 40], 1000));
    // slow division by 7
    for (let i = 0; i < 10; i++) attempts.push(attempt('div', [84, 7], 5000));

    const stats = aggregate(attempts);
    const g = globalMedianMs(attempts);
    const ranked = rankWeaknesses(stats, g);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].stat.bucket).toBe('div:by7:xl');
    expect(ranked[0].slowness).toBeGreaterThan(1);
  });

  it('ignores low-sample buckets', () => {
    const stat = {
      bucket: 'div:by7:hi',
      label: 'x',
      op: 'div' as const,
      n: MIN_SAMPLES - 1,
      errors: 2,
      errorRate: 1,
      medianMs: 9999,
      p90Ms: 9999,
    };
    expect(weaknessScore(stat, 1000)).toBe(0);
  });

  it('weights errors into the score', () => {
    const errStat = {
      bucket: 'add:mid+mid',
      label: 'x',
      op: 'add' as const,
      n: 10,
      errors: 5,
      errorRate: 0.5,
      medianMs: 1000,
      p90Ms: 1000,
    };
    expect(weaknessScore(errStat, 1000)).toBeCloseTo(1.0); // 0 slow + 0.5*2
  });
});

describe('drills', () => {
  it('focus drill for ÷ by 7 pins divisor and disables other ops', () => {
    const plan = buildFocusDrill(DEFAULT_CONFIG, 'div:by7:hi');
    expect(plan.config.ops.div.enabled).toBe(true);
    expect(plan.config.ops.add.enabled).toBe(false);
    expect(plan.config.ops.div.a).toEqual({ min: 7, max: 7 });
  });

  it('focus drill for ×7 pins the small factor', () => {
    const plan = buildFocusDrill(DEFAULT_CONFIG, 'mul:x7:xl');
    expect(plan.config.ops.mul.a).toEqual({ min: 7, max: 7 });
  });
});
