import { cloneConfig } from '../engine/config';
import { generateProblem } from '../engine/generate';
import { BAND_RANGE, bandsIn, bucketLabel, bucketOf, opOfBucket, type Band } from '../engine/buckets';
import type { Attempt, GameConfig, Operation, Problem, Range } from '../engine/types';
import type { Rng } from '../engine/rng';

/**
 * Adaptive problem selection.
 *
 * Design goals (and the failure modes they guard against):
 *
 * 1. Recency-decayed stats (half-life ~120 attempts) — the mix shifts
 *    session-to-session as you improve; fixed weaknesses fall out of rotation
 *    instead of being drilled forever off stale data.
 * 2. Intrinsic-difficulty normalization — division is slower than addition
 *    for everyone, so "weak" means slower than expected *for that operation*,
 *    not "division exists". Multipliers below are tunable heuristics from
 *    typical mental-math timing ratios.
 * 3. Shrinkage prior — low-sample buckets are pulled toward their op's
 *    average (n/(n+k)), so one hesitation can't hijack the mix.
 * 4. Exploitation cap + exploration floor — no single bucket exceeds
 *    MAX_BUCKET_SHARE of selection; everything not allocated to weak buckets
 *    stays uniformly random across enabled ops. Your worst spot shows up
 *    ~1 in 3, not 9 in 10, and the engine keeps collecting fresh signal on
 *    everything else.
 * 5. Anti-repeat guards at pick time (see makeAdaptiveSelector) — no literal
 *    problem repeats within a window, no 3+ consecutive problems from the
 *    same bucket. Interleaved practice beats blocked practice for retention.
 */

/** Intrinsic per-op time multipliers relative to addition (tunable heuristics). */
export const INTRINSIC: Record<Operation, number> = { add: 1.0, sub: 1.2, mul: 1.55, div: 1.7 };

export const HALF_LIFE_ATTEMPTS = 120;
export const SHRINK_K = 4;
export const EXPLOIT_BUDGET = 0.65; // max total probability mass given to weak buckets
export const MAX_BUCKET_SHARE = 0.3; // absolute cap for any single bucket
/** Total need at which the exploit budget saturates. Below this, targeted mass
 *  shrinks proportionally — as weaknesses fade, the session drifts back toward
 *  pure random instead of force-feeding whatever is "least fine". */
export const NEED_SATURATION = 1.0;
const NEED_THRESHOLD = 0.05;

export interface AdaptiveEntry {
  bucket: string;
  op: Operation;
  prob: number; // absolute selection probability
  need: number;
  config: GameConfig; // config constrained to (approximately) this bucket
}

export interface AdaptiveTarget {
  bucket: string;
  label: string;
  op: Operation;
  need: number;
  rel: number; // observed / expected time ratio
  errorRate: number;
  n: number; // effective (decayed) sample size
}

export interface AdaptivePlan {
  entries: AdaptiveEntry[]; // weak buckets that receive targeted mass
  exploreShare: number; // remaining mass: uniform over enabled ops
  opConfigs: Partial<Record<Operation, GameConfig>>;
  targets: AdaptiveTarget[]; // top weak spots, for display
  attemptsSeen: number;
}

interface Acc {
  timeW: number; // Σ w over correct attempts
  timeSum: number; // Σ w * timeMs over correct attempts
  allW: number; // Σ w over all attempts
  errSum: number; // Σ w * !correct
}

const newAcc = (): Acc => ({ timeW: 0, timeSum: 0, allW: 0, errSum: 0 });

function accumulate(acc: Acc, a: Attempt, w: number): void {
  acc.allW += w;
  if (a.correct) {
    acc.timeW += w;
    acc.timeSum += w * a.timeMs;
  } else {
    acc.errSum += w;
  }
}

const meanTime = (a: Acc): number => (a.timeW > 0 ? a.timeSum / a.timeW : 0);
const errRate = (a: Acc): number => (a.allW > 0 ? a.errSum / a.allW : 0);

function intersect(r1: Range, r2: Range): Range | null {
  const min = Math.max(r1.min, r2.min);
  const max = Math.min(r1.max, r2.max);
  return min <= max ? { min, max } : null;
}

function opOnlyConfig(cfg: GameConfig, op: Operation): GameConfig {
  const c = cloneConfig(cfg);
  (Object.keys(c.ops) as Operation[]).forEach((o) => (c.ops[o].enabled = o === op));
  return c;
}

/**
 * Constrain a config to (approximately) generate within one bucket.
 * Sub/add band targeting is approximate at the fringes — bucketOf classifies
 * the emitted problem truthfully, so weighting noise stays small.
 * Returns null when the bucket isn't realizable under the config's ranges.
 */
export function bucketConfig(cfg: GameConfig, bucket: string): GameConfig | null {
  const op = opOfBucket(bucket);
  if (!cfg.ops[op]?.enabled) return null;
  const base = opOnlyConfig(cfg, op);
  const oc = base.ops[op];
  const parts = bucket.split(':');

  if (op === 'mul' || op === 'div') {
    const f = Number(parts[1].replace(op === 'mul' ? 'x' : 'by', ''));
    if (!Number.isFinite(f) || f < oc.a.min || f > oc.a.max) return null;
    const bd = parts[2] as Band;
    const br = BAND_RANGE[bd];
    if (!br) return null;
    oc.a = { min: f, max: f };
    if (op === 'mul') {
      // bucketOf keys mul by the SMALLER operand, so the other operand must be
      // >= f for the emitted bucket to actually be mul:xf (else min(f,b)=b).
      const large = intersect(br, oc.b);
      const b = large && intersect(large, { min: f, max: Number.MAX_SAFE_INTEGER });
      if (!b) return null;
      oc.b = b;
    } else {
      // dividend = f * b must land in the band (xl is open above 100)
      const bMin = Math.ceil(br.min / f);
      const bMax = bd === 'xl' ? oc.b.max : Math.floor(br.max / f);
      const b = intersect({ min: bMin, max: bMax }, oc.b);
      if (!b) return null;
      oc.b = b;
    }
    return base;
  }

  if (op === 'add') {
    const [b1, b2] = parts[1].split('+') as Band[];
    const r1 = BAND_RANGE[b1];
    const r2 = BAND_RANGE[b2];
    if (!r1 || !r2) return null;
    // try (a←b1, b←b2), else swapped
    let a = intersect(r1, oc.a);
    let b = intersect(r2, oc.b);
    if (!a || !b) {
      a = intersect(r2, oc.a);
      b = intersect(r1, oc.b);
    }
    if (!a || !b) return null;
    oc.a = a;
    oc.b = b;
    return base;
  }

  // sub — displayed minuend band × subtrahend band; approximate a-range
  const [lb, rb] = parts[1].split('-') as Band[];
  const lr = BAND_RANGE[lb];
  const rr = BAND_RANGE[rb];
  if (!lr || !rr) return null;
  const b = intersect(rr, oc.b);
  if (!b) return null;
  const a = intersect(
    { min: lr.min - b.max, max: lb === 'xl' ? oc.a.max : lr.max - b.min },
    oc.a,
  );
  if (!a) return null;
  oc.a = a;
  oc.b = b;
  return base;
}

/** All bucket keys plausibly realizable under the config's enabled ops/ranges. */
export function realizableBuckets(cfg: GameConfig): string[] {
  const keys = new Set<string>();
  const ops = (Object.keys(cfg.ops) as Operation[]).filter((o) => cfg.ops[o].enabled);
  for (const op of ops) {
    const oc = cfg.ops[op];
    if (op === 'add') {
      for (const x of bandsIn(oc.a))
        for (const y of bandsIn(oc.b)) keys.add(`add:${[x, y].sort().join('+')}`);
    } else if (op === 'sub') {
      const left = { min: oc.a.min + oc.b.min, max: oc.a.max + oc.b.max };
      for (const lb of bandsIn(left)) for (const rb of bandsIn(oc.b)) keys.add(`sub:${lb}-${rb}`);
    } else {
      const fLo = Math.max(2, oc.a.min);
      const fHi = Math.min(12, oc.a.max);
      for (let f = fLo; f <= fHi; f++) {
        if (op === 'mul') {
          for (const bd of bandsIn(oc.b)) keys.add(`mul:x${f}:${bd}`);
        } else {
          const div = { min: f * oc.b.min, max: f * oc.b.max };
          for (const bd of bandsIn(div)) keys.add(`div:by${f}:${bd}`);
        }
      }
    }
  }
  return [...keys];
}

/** Build the session plan from historical attempts (newest data dominates). */
export function buildAdaptivePlan(attempts: Attempt[], cfg: GameConfig): AdaptivePlan {
  const ops = (Object.keys(cfg.ops) as Operation[]).filter((o) => cfg.ops[o].enabled);
  const opConfigs: Partial<Record<Operation, GameConfig>> = {};
  for (const op of ops) opConfigs[op] = opOnlyConfig(cfg, op);

  // Recency-weighted accumulation, newest first.
  const sorted = [...attempts].sort((a, b) => b.ts - a.ts);
  const byBucket = new Map<string, Acc>();
  const byOp = new Map<Operation, Acc>();
  const global = newAcc();
  let intrinsicSum = 0;
  sorted.forEach((a, i) => {
    const w = Math.pow(0.5, i / HALF_LIFE_ATTEMPTS);
    let acc = byBucket.get(a.bucket);
    if (!acc) byBucket.set(a.bucket, (acc = newAcc()));
    accumulate(acc, a, w);
    let oacc = byOp.get(a.op);
    if (!oacc) byOp.set(a.op, (oacc = newAcc()));
    accumulate(oacc, a, w);
    accumulate(global, a, w);
    intrinsicSum += w * INTRINSIC[a.op];
  });

  const globalT = meanTime(global);
  const intrinsicMix = global.allW > 0 ? intrinsicSum / global.allW : 1;

  const needOf = (bucket: string): { need: number; rel: number; err: number; n: number } => {
    const op = opOfBucket(bucket);
    const acc = byBucket.get(bucket);
    const oacc = byOp.get(op);
    const opT = oacc ? meanTime(oacc) : 0;
    if (!acc || acc.timeW === 0 || globalT === 0) {
      // no timing data — only an error signal, if any
      const err = acc ? errRate(acc) : 0;
      return { need: 1.5 * err, rel: 1, err, n: acc?.allW ?? 0 };
    }
    // shrink toward the op mean so tiny samples can't spike
    const raw = meanTime(acc);
    const prior = opT > 0 ? opT : globalT;
    const shrunk = (acc.timeW * raw + SHRINK_K * prior) / (acc.timeW + SHRINK_K);
    // expected time for this op given intrinsic difficulty
    const expected = (globalT * INTRINSIC[op]) / intrinsicMix;
    const rel = expected > 0 ? shrunk / expected : 1;
    const within = opT > 0 ? shrunk / opT : 1;
    const err = errRate(acc);
    const need = Math.max(0, rel - 1) + 0.4 * Math.max(0, within - 1) + 1.5 * err;
    return { need, rel, err, n: acc.allW };
  };

  // Score all realizable buckets; keep those with meaningful need + a config.
  const scored: { bucket: string; need: number; rel: number; err: number; n: number; config: GameConfig }[] = [];
  const targets: AdaptiveTarget[] = [];
  for (const bucket of realizableBuckets(cfg)) {
    const s = needOf(bucket);
    if (s.need <= NEED_THRESHOLD) continue;
    // Only surface buckets we can actually drill (a config exists), so a
    // "Next session target" is never something the selector can't produce.
    const config = bucketConfig(cfg, bucket);
    if (!config) continue;
    if (s.n > 0.5) {
      targets.push({
        bucket,
        label: bucketLabel(bucket),
        op: opOfBucket(bucket),
        need: s.need,
        rel: s.rel,
        errorRate: s.err,
        n: s.n,
      });
    }
    scored.push({ bucket, ...s, config });
  }
  targets.sort((a, b) => b.need - a.need);

  // Allocate: exploit budget scales with ABSOLUTE total need (mild weaknesses
  // get a small nudge, not the whole budget), split by need, capped per bucket.
  const totalNeed = scored.reduce((s, e) => s + e.need, 0);
  const budget = EXPLOIT_BUDGET * Math.min(1, totalNeed / NEED_SATURATION);
  const entries: AdaptiveEntry[] = scored
    .map((e) => ({
      bucket: e.bucket,
      op: opOfBucket(e.bucket),
      need: e.need,
      config: e.config,
      prob: totalNeed > 0 ? Math.min(budget * (e.need / totalNeed), MAX_BUCKET_SHARE) : 0,
    }))
    .filter((e) => e.prob > 0.005)
    .sort((a, b) => b.prob - a.prob);

  const exploitMass = entries.reduce((s, e) => s + e.prob, 0);
  return {
    entries,
    exploreShare: Math.max(0, 1 - exploitMass),
    opConfigs,
    targets: targets.slice(0, 5),
    attemptsSeen: attempts.length,
  };
}

/**
 * Per-session problem selector with anti-repeat guards:
 * - the same literal prompt never repeats within the last 8 problems
 * - never 3+ consecutive problems from the same targeted bucket
 */
export function makeAdaptiveSelector(plan: AdaptivePlan): (rng: Rng) => Problem {
  const ops = Object.keys(plan.opConfigs) as Operation[];
  const recentPrompts: string[] = [];
  // Guards track the ACTUAL bucket of emitted problems (explore draws can land
  // in a weak bucket too — runs must be bounded regardless of which path
  // produced the problem).
  let lastBucket = '';
  let bucketRun = 0;

  const explore = (rng: Rng): Problem => {
    const op = ops[Math.floor(rng() * ops.length)] ?? ops[0];
    return generateProblem(plan.opConfigs[op]!, rng);
  };

  const draw = (rng: Rng): Problem => {
    const u = rng();
    if (u < plan.exploreShare || plan.entries.length === 0) return explore(rng);
    let r = u - plan.exploreShare;
    let entry = plan.entries[plan.entries.length - 1];
    for (const e of plan.entries) {
      r -= e.prob;
      if (r < 0) {
        entry = e;
        break;
      }
    }
    return generateProblem(entry.config, rng);
  };

  return (rng: Rng): Problem => {
    let accepted: Problem | null = null;
    for (let i = 0; i < 6 && !accepted; i++) {
      // first try honours the weights; retries force exploration so a rejected
      // weak-bucket pick can't immediately re-land in the same bucket
      const candidate = i === 0 ? draw(rng) : explore(rng);
      const b = bucketOf(candidate);
      if (recentPrompts.includes(candidate.prompt)) continue;
      if (b === lastBucket && bucketRun >= 2) continue;
      accepted = candidate;
    }
    // last resort: accept a repeat rather than stall the clock
    accepted ??= explore(rng);

    const b = bucketOf(accepted);
    bucketRun = b === lastBucket ? bucketRun + 1 : 1;
    lastBucket = b;
    recentPrompts.push(accepted.prompt);
    if (recentPrompts.length > 8) recentPrompts.shift();
    return accepted;
  };
}
