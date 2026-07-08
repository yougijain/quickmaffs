import { cloneConfig } from '../engine/config';
import type { GameConfig, Operation } from '../engine/types';
import { BAND_RANGE, opOfBucket, type Band } from '../engine/buckets';

// The old op-level "weakness mix" was superseded by the bucket-level adaptive
// engine in adaptive.ts.

export interface DrillPlan {
  config: GameConfig;
  focus: string[]; // human-readable labels of what's being targeted
}

/**
 * "Focus drill": pin the config to a single weak bucket. For mul/div we lock
 * the small factor (e.g. only "÷ by 7"); for add/sub we narrow to the weak
 * magnitude bands.
 */
export function buildFocusDrill(base: GameConfig, bucket: string, durationSec?: number): DrillPlan {
  const op = opOfBucket(bucket);
  const cfg = cloneConfig(base);
  if (durationSec) cfg.durationSec = durationSec;

  // Enable only the targeted operation.
  (Object.keys(cfg.ops) as Operation[]).forEach((o) => {
    cfg.ops[o].enabled = o === op;
  });

  const parts = bucket.split(':');
  if (op === 'mul') {
    const factor = Number(parts[1].replace('x', ''));
    cfg.ops.mul.a = { min: factor, max: factor };
  } else if (op === 'div') {
    const divisor = Number(parts[1].replace('by', ''));
    cfg.ops.div.a = { min: divisor, max: divisor };
  } else {
    cfg.ops[op].a = bandToRange(parts[1].split(/[+-]/)[0]);
    cfg.ops[op].b = bandToRange(parts[1].split(/[+-]/)[1]);
  }

  return { config: cfg, focus: [bucket] };
}

function bandToRange(b: string): { min: number; max: number } {
  return BAND_RANGE[b as Band] ?? { min: 2, max: 100 };
}
