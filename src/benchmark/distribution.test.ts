import { describe, expect, it } from 'vitest';
import { normalCdf, percentileFor, ordinal, bellCurvePoints, POPULATION } from './distribution';

describe('distribution model', () => {
  it('CDF at the mean is ~50%', () => {
    expect(normalCdf(POPULATION.mean)).toBeCloseTo(0.5, 2);
  });

  it('CDF at mean+sd is ~84%, mean-sd is ~16%', () => {
    expect(normalCdf(POPULATION.mean + POPULATION.sd)).toBeCloseTo(0.841, 2);
    expect(normalCdf(POPULATION.mean - POPULATION.sd)).toBeCloseTo(0.159, 2);
  });

  it('matches the calibration anchors within tolerance', () => {
    expect(percentileFor(40)).toBeGreaterThan(30);
    expect(percentileFor(40)).toBeLessThan(45);
    expect(percentileFor(60)).toBeGreaterThan(80);
    expect(percentileFor(78)).toBeGreaterThan(97);
  });

  it('percentile is monotonic and clamped', () => {
    expect(percentileFor(0)).toBeGreaterThanOrEqual(0.5);
    expect(percentileFor(200)).toBeLessThanOrEqual(99.9);
    expect(percentileFor(50)).toBeGreaterThan(percentileFor(40));
  });

  it('ordinal suffixes', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(63)).toBe('63rd');
  });

  it('bell curve peaks at the mean', () => {
    const pts = bellCurvePoints(100);
    const peak = pts.reduce((m, p) => (p.y > m.y ? p : m));
    expect(Math.abs(peak.x - POPULATION.mean)).toBeLessThan(2);
    expect(peak.y).toBeCloseTo(1, 2);
  });
});
