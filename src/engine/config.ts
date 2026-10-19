import type { GameConfig } from './types';

/**
 * Faithful Zetamac defaults (arithmetic.zetamac.com):
 *  - addition:       a,b in [2,100]
 *  - subtraction:    inverse of the same addition
 *  - multiplication: a in [2,12] (small factor), b in [2,100]
 *  - division:       inverse of the same multiplication
 *  - 120 second timer, score = number correct
 */
export const DEFAULT_CONFIG: GameConfig = {
  durationSec: 120,
  ops: {
    add: { enabled: true, a: { min: 2, max: 100 }, b: { min: 2, max: 100 } },
    sub: { enabled: true, a: { min: 2, max: 100 }, b: { min: 2, max: 100 } },
    mul: { enabled: true, a: { min: 2, max: 12 }, b: { min: 2, max: 100 } },
    div: { enabled: true, a: { min: 2, max: 12 }, b: { min: 2, max: 100 } },
  },
};

export const DEFAULT_GOAL_SCORE = 40;

export function cloneConfig(cfg: GameConfig): GameConfig {
  return {
    durationSec: cfg.durationSec,
    seed: cfg.seed,
    ops: {
      add: { ...cfg.ops.add, a: { ...cfg.ops.add.a }, b: { ...cfg.ops.add.b } },
      sub: { ...cfg.ops.sub, a: { ...cfg.ops.sub.a }, b: { ...cfg.ops.sub.b } },
      mul: { ...cfg.ops.mul, a: { ...cfg.ops.mul.a }, b: { ...cfg.ops.mul.b } },
      div: { ...cfg.ops.div, a: { ...cfg.ops.div.a }, b: { ...cfg.ops.div.b } },
    },
  };
}
