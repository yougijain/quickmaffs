import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, cloneConfig } from './config';
import { mulberry32 } from './rng';
import { generateProblem, pickOp, enabledOps } from './generate';
import { bucketOf, band, bucketLabel } from './buckets';
import type { GameConfig, Operation } from './types';

function onlyOp(op: Operation): GameConfig {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  (Object.keys(cfg.ops) as Operation[]).forEach((o) => (cfg.ops[o].enabled = o === op));
  return cfg;
}

describe('generateProblem — invariants over 2000 samples per op', () => {
  const ops: Operation[] = ['add', 'sub', 'mul', 'div'];
  for (const op of ops) {
    it(`${op}: answers are non-negative integers and prompts evaluate correctly`, () => {
      const cfg = onlyOp(op);
      const rng = mulberry32(12345);
      for (let i = 0; i < 2000; i++) {
        const p = generateProblem(cfg, rng);
        expect(p.op).toBe(op);
        expect(Number.isInteger(p.answer)).toBe(true);
        expect(p.answer).toBeGreaterThanOrEqual(0);
        const [x, y] = p.operands;
        // Recompute the answer from the displayed operands.
        const expected = { add: x + y, sub: x - y, mul: x * y, div: x / y }[op];
        expect(p.answer).toBe(expected);
      }
    });
  }

  it('division always yields exact integer quotients', () => {
    const cfg = onlyOp('div');
    const rng = mulberry32(999);
    for (let i = 0; i < 2000; i++) {
      const p = generateProblem(cfg, rng);
      const [x, y] = p.operands;
      expect(x % y).toBe(0);
    }
  });

  it('respects operand ranges (default multiplication: small factor 2-12)', () => {
    const cfg = onlyOp('mul');
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const p = generateProblem(cfg, rng);
      const [x, y] = p.operands;
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(12);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('subtraction never displays a smaller-minus-larger', () => {
    const cfg = onlyOp('sub');
    const rng = mulberry32(42);
    for (let i = 0; i < 2000; i++) {
      const p = generateProblem(cfg, rng);
      expect(p.operands[0]).toBeGreaterThanOrEqual(p.operands[1]);
    }
  });

  it('is reproducible for a fixed seed', () => {
    const a = generateProblem(DEFAULT_CONFIG, mulberry32(555));
    const b = generateProblem(DEFAULT_CONFIG, mulberry32(555));
    expect(a.prompt).toBe(b.prompt);
    expect(a.answer).toBe(b.answer);
  });
});

describe('pickOp', () => {
  it('only returns enabled ops', () => {
    const cfg = onlyOp('div');
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) expect(pickOp(cfg, rng)).toBe('div');
  });

  it('honours weights (heavily-weighted op dominates)', () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    const rng = mulberry32(3);
    let mul = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickOp(cfg, rng, { add: 0.01, sub: 0.01, mul: 100, div: 0.01 }) === 'mul') mul++;
    }
    expect(mul).toBeGreaterThan(950);
  });

  it('throws when nothing is enabled', () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    (Object.keys(cfg.ops) as Operation[]).forEach((o) => (cfg.ops[o].enabled = false));
    expect(enabledOps(cfg)).toHaveLength(0);
    expect(() => pickOp(cfg, mulberry32(1))).toThrow();
  });
});

describe('buckets', () => {
  it('bands operands correctly', () => {
    expect(band(5)).toBe('sm');
    expect(band(20)).toBe('lo');
    expect(band(40)).toBe('mid');
    expect(band(70)).toBe('hi');
    expect(band(99)).toBe('xl');
  });

  it('keys the small factor for mul/div', () => {
    expect(bucketOf({ op: 'div', operands: [84, 7] })).toBe('div:by7:xl');
    expect(bucketOf({ op: 'mul', operands: [7, 84] })).toBe('mul:x7:xl');
    // multiplication bucket is order-independent on the small factor
    expect(bucketOf({ op: 'mul', operands: [84, 7] })).toBe('mul:x7:xl');
    // a dividend in the 51-75 band lands in "hi"
    expect(bucketOf({ op: 'div', operands: [63, 7] })).toBe('div:by7:hi');
  });

  it('addition buckets are symmetric', () => {
    expect(bucketOf({ op: 'add', operands: [80, 20] })).toBe(bucketOf({ op: 'add', operands: [20, 80] }));
  });

  it('produces readable labels', () => {
    expect(bucketLabel('div:by7:hi')).toContain('7');
    expect(bucketLabel('mul:x7:hi')).toContain('7');
  });
});
