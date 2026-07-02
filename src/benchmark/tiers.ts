export interface Tier {
  key: string;
  label: string;
  min: number; // minimum score (on the 120s default) to reach this tier
  blurb: string;
  color: string; // tailwind color family name
}

/**
 * Benchmark ladder for the 120s Zetamac default, derived from quant-interview
 * guidance: ~30 solid start · 40 interview-ready/competitive · 50 strong ·
 * 60+ elite (top prop-trading pace).
 */
export const TIERS: Tier[] = [
  { key: 'warmup', label: 'Warming Up', min: 0, blurb: 'Keep drilling the fundamentals.', color: 'slate' },
  { key: 'start', label: 'Solid Start', min: 30, blurb: 'Good foundation — now build speed.', color: 'sky' },
  {
    key: 'inter',
    label: 'Interview-Ready',
    min: 40,
    blurb: 'Competitive for most quant mental-math screens.',
    color: 'emerald',
  },
  { key: 'strong', label: 'Strong', min: 50, blurb: 'Above the bar at top trading desks.', color: 'violet' },
  { key: 'elite', label: 'Elite', min: 60, blurb: 'Top-tier prop-trading pace.', color: 'amber' },
];

export function tierFor(score: number): Tier {
  let result = TIERS[0];
  for (const t of TIERS) if (score >= t.min) result = t;
  return result;
}

export function nextTier(score: number): Tier | null {
  return TIERS.find((t) => t.min > score) ?? null;
}
