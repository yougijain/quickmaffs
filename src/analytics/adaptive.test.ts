import { describe, expect, it } from 'vitest';
import {
  buildAdaptivePlan,
  bucketConfig,
  makeAdaptiveSelector,
  realizableBuckets,
  MAX_BUCKET_SHARE,
} from './adaptive';
import { DEFAULT_CONFIG } from '../engine/config';
import { mulberry32 } from '../engine/rng';
import { bucketOf } from '../engine/buckets';
import { generateProblem } from '../engine/generate';
import type { Attempt } from '../engine/types';

let ts = 1_000_000;
function attempt(op: Attempt['op'], operands: [number, number], timeMs: number, correct = true): Attempt {
  ts += 1000;
  return {
    id: `${ts}`,
    sessionId: 's',
    idx: 0,
    op,
    operands,
    answer: 0,
    given: correct ? 0 : 1,
    correct,
    timeMs,
    firstInputMs: null,
    corrections: 0,
    answerDigits: 1,
    prompt: '',
    bucket: bucketOf({ op, operands }),
    targeted: false,
    ts,
  };
}

/** Baseline history: broadly normal performance with one slow spot (÷ by 7). */
function slowDiv7History(): Attempt[] {
  const out: Attempt[] = [];
  for (let i = 0; i < 40; i++) out.push(attempt('add', [30, 40], 1100));
  for (let i = 0; i < 15; i++) out.push(attempt('sub', [80, 30], 1300));
  for (let i = 0; i < 15; i++) out.push(attempt('mul', [6, 40], 1700));
  for (let i = 0; i < 8; i++) out.push(attempt('div', [54, 6], 1800)); // normal division
  for (let i = 0; i < 12; i++) out.push(attempt('div', [84, 7], 5200)); // slow spot
  return out;
}

function selectionHistogram(plan: ReturnType<typeof buildAdaptivePlan>, draws: number) {
  const pick = makeAdaptiveSelector(plan);
  const rng = mulberry32(42);
  const byOp: Record<string, number> = { add: 0, sub: 0, mul: 0, div: 0 };
  const byBucket = new Map<string, number>();
  const prompts: string[] = [];
  let maxRun = 0;
  let run = 0;
  let last = '';
  for (let i = 0; i < draws; i++) {
    const p = pick(rng);
    byOp[p.op]++;
    const b = bucketOf(p);
    byBucket.set(b, (byBucket.get(b) ?? 0) + 1);
    if (b === last) run++;
    else run = 1;
    maxRun = Math.max(maxRun, run);
    last = b;
    prompts.push(p.prompt);
  }
  return { byOp, byBucket, prompts, maxRun };
}

describe('buildAdaptivePlan', () => {
  it('targets the genuinely slow bucket, not division per se', () => {
    const plan = buildAdaptivePlan(slowDiv7History(), DEFAULT_CONFIG);
    expect(plan.targets.length).toBeGreaterThan(0);
    expect(plan.targets[0].bucket).toBe('div:by7:xl');
    // normal-speed division (÷6 at 1800ms) should NOT lead the target list
    expect(plan.targets[0].bucket).not.toBe('div:by6:mid');
    const top = plan.entries[0];
    expect(top.bucket).toBe('div:by7:xl');
    expect(top.prob).toBeLessThanOrEqual(MAX_BUCKET_SHARE + 1e-9);
  });

  it('keeps a real exploration floor', () => {
    const plan = buildAdaptivePlan(slowDiv7History(), DEFAULT_CONFIG);
    expect(plan.exploreShare).toBeGreaterThanOrEqual(0.35);
    const { byOp } = selectionHistogram(plan, 2000);
    // every enabled op keeps meaningful presence
    for (const op of ['add', 'sub', 'mul', 'div'] as const) {
      expect(byOp[op] / 2000).toBeGreaterThan(0.05);
    }
    // the weak bucket is oversampled but bounded
    const div7Share = ([...selectionHistogram(plan, 2000).byBucket].find(([k]) => k === 'div:by7:xl')?.[1] ?? 0) / 2000;
    expect(div7Share).toBeGreaterThan(0.12);
    expect(div7Share).toBeLessThan(0.45);
  });

  it('shifts session-to-session: improvement decays the weight', () => {
    const history = slowDiv7History();
    const before = buildAdaptivePlan(history, DEFAULT_CONFIG);
    const div7Before = before.entries.find((e) => e.bucket === 'div:by7:xl')?.prob ?? 0;

    // a later session where ÷7 is now fast
    const improved = [...history];
    for (let i = 0; i < 30; i++) improved.push(attempt('div', [84, 7], 1500));
    const after = buildAdaptivePlan(improved, DEFAULT_CONFIG);
    const div7After = after.entries.find((e) => e.bucket === 'div:by7:xl')?.prob ?? 0;

    expect(div7Before).toBeGreaterThan(0.1);
    expect(div7After).toBeLessThan(div7Before * 0.5);
  });

  it('errors raise need even without slow times', () => {
    const history: Attempt[] = [];
    for (let i = 0; i < 40; i++) history.push(attempt('add', [30, 40], 1100));
    for (let i = 0; i < 10; i++) history.push(attempt('mul', [8, 60], 1300, i % 2 === 0)); // 50% errors
    const plan = buildAdaptivePlan(history, DEFAULT_CONFIG);
    expect(plan.targets.some((t) => t.bucket.startsWith('mul:x8'))).toBe(true);
  });

  it('with no history it degenerates to pure exploration', () => {
    const plan = buildAdaptivePlan([], DEFAULT_CONFIG);
    expect(plan.entries).toHaveLength(0);
    expect(plan.exploreShare).toBe(1);
    const { byOp } = selectionHistogram(plan, 1000);
    for (const op of ['add', 'sub', 'mul', 'div'] as const) expect(byOp[op]).toBeGreaterThan(150);
  });
});

describe('makeAdaptiveSelector guards', () => {
  it('never runs the same bucket 3+ times consecutively', () => {
    const plan = buildAdaptivePlan(slowDiv7History(), DEFAULT_CONFIG);
    const { maxRun } = selectionHistogram(plan, 1500);
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('avoids repeating the same literal prompt back-to-back', () => {
    // Narrow config making repeats likely: only ÷7 problems available
    const history: Attempt[] = [];
    for (let i = 0; i < 30; i++) history.push(attempt('div', [84, 7], 5000));
    const plan = buildAdaptivePlan(history, DEFAULT_CONFIG);
    const pick = makeAdaptiveSelector(plan);
    const rng = mulberry32(7);
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const p = pick(rng);
      expect(p.prompt).not.toBe(prev);
      prev = p.prompt;
    }
  });
});

describe('bucketConfig', () => {
  const rng = mulberry32(123);

  it('mul bucket generates exactly within the bucket', () => {
    const cfg = bucketConfig(DEFAULT_CONFIG, 'mul:x7:xl')!;
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(cfg, rng);
      expect(bucketOf(p)).toBe('mul:x7:xl');
    }
  });

  it('div bucket generates exactly within the bucket', () => {
    const cfg = bucketConfig(DEFAULT_CONFIG, 'div:by7:hi')!;
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(cfg, rng);
      expect(bucketOf(p)).toBe('div:by7:hi');
    }
  });

  it('add bucket stays within the targeted bands', () => {
    const cfg = bucketConfig(DEFAULT_CONFIG, 'add:hi+xl')!;
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(cfg, rng);
      expect(bucketOf(p)).toBe('add:hi+xl');
    }
  });

  it('returns null for unrealizable buckets', () => {
    expect(bucketConfig(DEFAULT_CONFIG, 'mul:x20:xl')).toBeNull();
    expect(bucketConfig(DEFAULT_CONFIG, 'div:by2:xl')).not.toBeNull();
  });
});

describe('realizableBuckets', () => {
  it('enumerates factors and bands under the default config', () => {
    const keys = realizableBuckets(DEFAULT_CONFIG);
    expect(keys).toContain('mul:x7:xl');
    expect(keys).toContain('div:by7:hi');
    expect(keys).toContain('add:hi+xl');
    expect(keys.some((k) => k.startsWith('sub:'))).toBe(true);
    // no factor outside 2..12
    expect(keys).not.toContain('mul:x13:xl');
  });
});
