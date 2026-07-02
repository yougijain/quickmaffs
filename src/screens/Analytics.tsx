import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useSessions, useSettings, useWeaknesses } from '../data/hooks';
import { buildFocusDrill } from '../analytics/drills';
import { Button, Card } from '../components/ui';
import { formatDate, formatMs, pct } from '../lib/format';
import { MIN_SAMPLES } from '../analytics/weakness';

export default function Analytics() {
  const navigate = useNavigate();
  const data = useWeaknesses(6);
  const sessions = useSessions();
  const settings = useSettings();
  const start = useGameStore((s) => s.start);

  const drillBucket = (bucket: string) => {
    if (!settings) return;
    const plan = buildFocusDrill(settings.config, bucket, 120);
    start(plan.config, { mode: 'drill', focus: plan.focus.map(labelFor) });
    navigate('/game');
  };

  const labelFor = (b: string) => data?.stats.find((s) => s.bucket === b)?.label ?? b;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight">Your stats</h1>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Weak spots</h2>
          <span className="text-xs text-slate-500">{data?.total ?? 0} problems logged</span>
        </div>

        {!data || data.total < MIN_SAMPLES ? (
          <p className="text-sm text-slate-400">
            Play a few drills — once you’ve logged enough problems, your slowest and most error-prone areas show up
            here with one-tap focus practice.
          </p>
        ) : data.ranked.length === 0 ? (
          <p className="text-sm text-emerald-300">No clear weak spots — your speed is even across the board. 💪</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.ranked.map((r) => (
              <div key={r.stat.bucket} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">{r.stat.label}</div>
                  <div className="text-xs text-slate-400">
                    {formatMs(r.stat.medianMs)} median
                    {r.slowness > 1 && <span className="text-amber-300"> · {r.slowness.toFixed(1)}× slower</span>}
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent sessions</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-slate-400">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{formatDate(s.startedAt)}</span>
                <span className="flex items-center gap-2">
                  {s.mode !== 'classic' && (
                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{s.mode}</span>
                  )}
                  <span className="font-bold tabular-nums text-emerald-400">{s.score}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
