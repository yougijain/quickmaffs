/**
 * Population score model for the 120s Zetamac default.
 *
 * There is no official public Zetamac score dataset, so this is a normal-
 * distribution MODEL calibrated to widely-cited community / quant-interview
 * benchmark anchors (the self-selected quant-prep population — the relevant
 * comparison group for this app):
 *
 *   score  ~percentile  anchor
 *     30       16%       weak / early
 *     40       37%       "floor where you stop being cut"
 *     50       63%       strong
 *     60       84%       competitive at top desks
 *     78       99%       top 1-2%
 *
 * Normal(mean=45, sd=15) reproduces all of these to within a few points.
 * Sources: quant-interview guides (spacecomplexity, thewallstreetquants,
 * quantquestions) and community reports (WSO, QuantNet, LiquidPoker).
 *
 * These are just two numbers — adjust POPULATION if better data surfaces.
 */
export const POPULATION = { mean: 45, sd: 15 } as const;

/** Standard normal CDF via Abramowitz & Stegun 7.1.26 erf approximation. */
export function normalCdf(x: number, mean = POPULATION.mean, sd = POPULATION.sd): number {
  const z = (x - mean) / (sd * Math.SQRT2);
  // erf(z)
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  const erf = z >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

/** Normal probability density (for drawing the bell curve). */
export function normalPdf(x: number, mean = POPULATION.mean, sd = POPULATION.sd): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/** Percentile (0-100) a score lands at in the population, clamped to [0.5, 99.9]. */
export function percentileFor(score: number): number {
  const p = normalCdf(score) * 100;
  return Math.min(99.9, Math.max(0.5, p));
}

/** Ordinal suffix helper: 1 -> "1st", 63 -> "63rd". */
export function ordinal(n: number): string {
  const r = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = r % 100;
  return r + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Sampled bell-curve points across a sensible score range, normalized to peak=1. */
export function bellCurvePoints(steps = 120): { x: number; y: number }[] {
  const min = 0;
  const max = Math.round(POPULATION.mean + 4 * POPULATION.sd); // ~105
  const peak = normalPdf(POPULATION.mean);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + ((max - min) * i) / steps;
    pts.push({ x, y: normalPdf(x) / peak });
  }
  return pts;
}
