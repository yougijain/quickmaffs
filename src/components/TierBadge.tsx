import { TIERS, nextTier, tierFor, type Tier } from '../benchmark/tiers';

const COLOR: Record<string, { text: string; bar: string; border: string }> = {
  slate: { text: 'text-slate-300', bar: 'bg-slate-500', border: 'border-slate-500/40' },
  sky: { text: 'text-sky-300', bar: 'bg-sky-400', border: 'border-sky-400/40' },
  emerald: { text: 'text-brand', bar: 'bg-brand', border: 'border-brand/40' },
  violet: { text: 'text-violet-300', bar: 'bg-violet-400', border: 'border-violet-400/40' },
  amber: { text: 'text-gold', bar: 'bg-gold', border: 'border-gold/40' },
};

/** Rank symbol (D → S) for a score's tier. Rank tracks your TOP score. */
export function RankBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const tier = tierFor(score);
  const c = COLOR[tier.color] ?? COLOR.slate;
  const dim = size === 'lg' ? 'h-11 w-11 text-2xl' : size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-base';
  return (
    <span
      title={`Rank ${tier.rank} · ${tier.label}`}
      className={`inline-flex items-center justify-center rounded-xl border ${c.border} bg-ink-800/70 font-black tabular-nums ${c.text} ${dim}`}
    >
      {tier.rank}
    </span>
  );
}

/** Small "new personal best" pill. */
export function NewBestPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
      ▲ Personal best
    </span>
  );
}

export function TierBadge({ tier, large }: { tier: Tier; large?: boolean }) {
  const c = COLOR[tier.color] ?? COLOR.slate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-800/80 ${c.text} ${
        large ? 'px-4 py-1.5 text-sm font-semibold' : 'px-3 py-1 text-xs font-medium'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.bar}`} />
      {tier.label}
    </span>
  );
}

/** Segmented ladder showing all tiers with the current score marked. */
export function TierLadder({ score }: { score: number }) {
  const current = tierFor(score);
  return (
    <div className="flex gap-1.5">
      {TIERS.map((t) => {
        const c = COLOR[t.color] ?? COLOR.slate;
        const reached = score >= t.min;
        const isCurrent = t.key === current.key;
        return (
          <div key={t.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div className={`h-1.5 w-full rounded-full ${reached ? c.bar : 'bg-ink-800'}`} />
            <span className={`text-[10px] tabular-nums ${isCurrent ? c.text + ' font-semibold' : 'text-faint'}`}>
              {t.min}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function GoalProgress({ score, goal }: { score: number; goal: number }) {
  const next = nextTier(score);
  const pct = Math.min(1, goal > 0 ? score / goal : 1);
  return (
    <div className="w-full">
      <div className="mb-1.5 flex justify-between text-[13px] text-muted">
        <span>Goal {goal}</span>
        <span className="tabular-nums">{score >= goal ? 'reached' : `${goal - score} to go`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct * 100}%` }} />
      </div>
      {next && score < goal && (
        <p className="mt-2 text-xs text-faint">
          {next.min - score} more to reach <span className="text-muted">{next.label}</span>
        </p>
      )}
    </div>
  );
}
