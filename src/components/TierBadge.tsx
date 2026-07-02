import { TIERS, nextTier, tierFor, type Tier } from '../benchmark/tiers';

const COLOR: Record<string, { text: string; bg: string; ring: string; bar: string }> = {
  slate: { text: 'text-slate-300', bg: 'bg-slate-500/15', ring: 'ring-slate-500/40', bar: 'bg-slate-400' },
  sky: { text: 'text-sky-300', bg: 'bg-sky-500/15', ring: 'ring-sky-500/40', bar: 'bg-sky-400' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', bar: 'bg-emerald-400' },
  violet: { text: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/40', bar: 'bg-violet-400' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-500/40', bar: 'bg-amber-400' },
};

export function TierBadge({ tier, large }: { tier: Tier; large?: boolean }) {
  const c = COLOR[tier.color] ?? COLOR.slate;
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ${c.bg} ${c.text} ${c.ring} ${
        large ? 'px-4 py-1.5 text-base font-bold' : 'px-3 py-1 text-sm font-semibold'
      }`}
    >
      {tier.label}
    </span>
  );
}

/** Segmented ladder showing all tiers with the current score marked. */
export function TierLadder({ score }: { score: number }) {
  const current = tierFor(score);
  return (
    <div className="flex gap-1">
      {TIERS.map((t) => {
        const c = COLOR[t.color] ?? COLOR.slate;
        const reached = score >= t.min;
        const isCurrent = t.key === current.key;
        return (
          <div key={t.key} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-2 w-full rounded-full ${reached ? c.bar : 'bg-ink-800'}`} />
            <span className={`text-[10px] ${isCurrent ? c.text + ' font-bold' : 'text-slate-500'}`}>{t.min}</span>
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
      <div className="mb-1 flex justify-between text-sm text-slate-400">
        <span>Goal: {goal}</span>
        <span>{score >= goal ? '🎯 reached' : `${goal - score} to go`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct * 100}%` }} />
      </div>
      {next && score < goal && (
        <p className="mt-2 text-xs text-slate-500">
          {next.min - score} more to hit <span className="text-slate-300">{next.label}</span>
        </p>
      )}
    </div>
  );
}
