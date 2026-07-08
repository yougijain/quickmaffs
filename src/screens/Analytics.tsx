import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useSessions, useSettings, useWeaknesses } from '../data/hooks';
import { buildFocusDrill } from '../analytics/drills';
import { Button, Card } from '../components/ui';
import { formatDate, formatMs, pct } from '../lib/format';
import { MIN_SAMPLES } from '../analytics/weakness';
import { DistributionChart, ScoreHistoryChart } from '../components/charts';
import { ordinal, percentileFor } from '../benchmark/distribution';
import { tierFor } from '../benchmark/tiers';

export default function Analytics() {
  const navigate = useNavigate();
  const data = useWeaknesses(6);
  const sessions = useSessions();
  const settings = useSettings();
  const start = useGameStore((s) => s.start);

  // Only standard 120s classic runs are apples-to-apples with the population
  // benchmark, so progress + percentile use those.
  const classicRuns = (sessions ?? [])
    .filter((s) => s.mode === 'classic' && s.durationSec === 120)
    .sort((a, b) => a.startedAt - b.startedAt);
  const bestClassic = classicRuns.reduce((m, s) => Math.max(m, s.score), 0);
  const goal = settings?.goalScore ?? 40;

  const drillBucket = (bucket: string) => {
    if (!settings) return;
    const plan = buildFocusDrill(settings.config, bucket, 120);
    start(plan.config, { mode: 'drill', focus: plan.focus.map(labelFor) });
    navigate('/game');
  };

  const labelFor = (b: string) => data?.stats.find((s) => s.bucket === b)?.label ?? b;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-bold tracking-tight">Your stats</h1>

      <Card>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Your progress</h2>
        {classicRuns.length === 0 ? (
          <p className="text-sm text-muted">
            Play a <span className="text-fg">120s classic drill</span> to start plotting your scores over
            time.
          </p>
        ) : (
          <>
            <ScoreHistoryChart data={classicRuns.map((s) => ({ t: s.startedAt, score: s.score }))} goal={goal} />
            <p className="mt-1 text-xs text-faint">
              {classicRuns.length} classic run{classicRuns.length === 1 ? '' : 's'} · best{' '}
              <span className="text-gold">{bestClassic}</span> · {tierFor(bestClassic).label}
            </p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Where you stand</h2>
        {bestClassic <= 0 ? (
          <p className="text-sm text-muted">
            Your best 120s score will be plotted against the population curve here.
          </p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums text-brand">{ordinal(percentileFor(bestClassic))}</span>
              <span className="text-sm text-muted">percentile — you beat ~{Math.round(percentileFor(bestClassic))}% of the field</span>
            </div>
            <DistributionChart score={bestClassic} />
            <p className="mt-1 text-xs text-faint">
              Modeled curve (normal, μ45/σ15) calibrated to community &amp; quant-interview benchmarks — there’s no
              official Zetamac dataset. Uses your best 120s classic score.
            </p>
          </>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Weak spots</h2>
          <span className="text-xs text-faint">{data?.total ?? 0} problems logged</span>
        </div>

        {!data || data.total < MIN_SAMPLES ? (
          <p className="text-sm text-muted">
            Play a few drills — once you’ve logged enough problems, your slowest and most error-prone areas show up
            here with one-tap focus practice.
          </p>
        ) : data.ranked.length === 0 ? (
          <p className="text-sm text-brand">No clear weak spots — your speed is even across the board. 💪</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.ranked.map((r) => (
              <div key={r.stat.bucket} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-fg">{r.stat.label}</div>
                  <div className="text-xs text-muted">
                    {formatMs(r.stat.medianMs)} median
                    {r.slowness > 1 && <span className="text-gold"> · {r.slowness.toFixed(1)}× slower</span>}
                    {r.stat.errorRate > 0 && <span className="text-red-300"> · {pct(r.stat.errorRate)} errors</span>}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="min-h-0 shrink-0 px-3 py-1.5 text-sm"
                  onClick={() => drillBucket(r.stat.bucket)}
                >
                  Drill
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Recent sessions</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">{formatDate(s.startedAt)}</span>
                <span className="flex items-center gap-2">
                  {s.mode !== 'classic' && (
                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-muted">{s.mode}</span>
                  )}
                  <span className="font-bold tabular-nums text-brand">{s.score}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
