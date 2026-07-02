import { OP_SYMBOL, type GameConfig, type Operation, type Problem } from './types';
import { randInt, type Rng } from './rng';
import { uuid } from '../lib/uuid';

export type OpWeights = Partial<Record<Operation, number>>;

export function enabledOps(cfg: GameConfig): Operation[] {
  return (Object.keys(cfg.ops) as Operation[]).filter((o) => cfg.ops[o].enabled);
}

/** Weighted random operation pick among enabled ops. */
export function pickOp(cfg: GameConfig, rng: Rng, weights?: OpWeights): Operation {
  const ops = enabledOps(cfg);
  if (ops.length === 0) throw new Error('No operations enabled');
  const w = ops.map((o) => Math.max(0, weights?.[o] ?? 1));
  const total = w.reduce((s, x) => s + x, 0);
  if (total <= 0) return ops[randInt(rng, 0, ops.length - 1)];
  let r = rng() * total;
  for (let i = 0; i < ops.length; i++) {
    r -= w[i];
    if (r < 0) return ops[i];
  }
  return ops[ops.length - 1];
}

/**
 * Generate one problem. Subtraction and division are produced as the inverse
 * of an addition/multiplication so answers are always non-negative integers
 * and share the difficulty distribution of their forward operation.
 */
export function generateProblem(cfg: GameConfig, rng: Rng, weights?: OpWeights): Problem {
  const op = pickOp(cfg, rng, weights);
  const oc = cfg.ops[op];
  const a = randInt(rng, oc.a.min, oc.a.max);
  const b = randInt(rng, oc.b.min, oc.b.max);

  let left: number;
  let right: number;
  let answer: number;

  switch (op) {
    case 'add':
      left = a;
      right = b;
      answer = a + b;
      break;
    case 'sub':
      // (a + b) − b = a  → non-negative, mirrors addition
      left = a + b;
      right = b;
      answer = a;
      break;
    case 'mul':
      left = a;
      right = b;
      answer = a * b;
      break;
    case 'div':
      // (a · b) ÷ a = b  → exact integer, divides by the small 2-12 factor
      left = a * b;
      right = a;
      answer = b;
      break;
  }

  return {
    id: uuid(),
    op,
    operands: [left, right],
    answer,
    prompt: `${left} ${OP_SYMBOL[op]} ${right}`,
  };
}
