import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useAdaptivePlan, useBenchmarkStats, useSettings } from '../data/hooks';
import { makeAdaptiveSelector } from '../analytics/adaptive';
import { DEFAULT_CONFIG, cloneConfig } from '../engine/config';
import { TIERS, tierFor } from '../benchmark/tiers';
import { TierBadge, TierLadder, GoalProgress, RankBadge } from '../components/TierBadge';
import { Button, Card, Eyebrow } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';

const INTERVIEW_READY = TIERS.find((t) => t.key === 'inter')!.min; // 40

export default function Home() {
  const navigate = useNavigate();
  const settings = useSettings();
  const plan = useAdaptivePlan();
  const bench = useBenchmarkStats() ?? { best: 0, average: 0, count: 0 };
  const best = bench.best;
  const start = useGameStore((s) => s.start);
  const { cloudEnabled, isAnonymous } = useAuth();

  const tier = tierFor(best);
  const goal = settings?.goalScore ?? 40;

  const startTraining = () => {
    if (!settings) return;
    start(settings.config, {
      mode: 'adaptive',
      selector: plan ? makeAdaptiveSelector(plan) : undefined,
      focus: plan?.targets.slice(0, 3).map((t) => t.label) ?? [],
      targetBuckets: plan?.targets.map((t) => t.bucket) ?? [],
    });
    navigate('/game');
  };

  // Benchmark = exact Zetamac defaults, 120s, pure random — always comparable.
  const startBenchmark = () => {
    start(cloneConfig(DEFAULT_CONFIG), { mode: 'classic' });
    navigate('/game');
  };

  const targeting = plan?.targets.slice(0, 2) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">QuickMaffs</h1>
          <p className="text-sm text-muted">Quant mental-math trainer</p>
        </div>
        <TierBadge tier={tier} />
      </header>

      <Card className="relative overflow-hidden">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Benchmark best</Eyebrow>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-[64px] font-bold leading-none tabular-nums text-brand">{best}</span>
              {/* Rank tracks your TOP score. */}
              <RankBadge score={best} size="lg" />
            </div>
          </div>
          <div className="mb-1 text-right text-xs text-faint">120s · Zetamac rules</div>
        </div>

        {/* Average = consistency. This is what must clear interview-ready. */}
        {bench.count > 0 && (
          <div className="mt-3 flex items-baseline gap-2 text-sm">
            <span className="text-muted">
              Average <span className="font-semibold tabular-nums text-fg">{bench.average}</span>
              <span className="text-faint"> · {bench.count} run{bench.count === 1 ? '' : 's'}</span>
            </span>
            <span className={`ml-auto text-xs ${bench.average >= INTERVIEW_READY ? 'text-brand' : 'text-faint'}`}>
              {bench.average >= INTERVIEW_READY
                ? 'consistently interview-ready'
                : `${INTERVIEW_READY - bench.average} to interview-ready avg`}
            </span>
          </div>
        )}

        <div className="mt-6">
          <TierLadder score={best} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <GoalProgress score={best} goal={goal} />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button onClick={startTraining} className="min-h-[3.75rem] text-base">
          Start training
        </Button>
        {targeting.length > 0 && (
          <p className="px-1 text-center text-xs text-faint">
            adapting to: {targeting.map((t) => t.label).join(' · ')}
          </p>
        )}
        <Button variant="secondary" onClick={startBenchmark}>
          120s benchmark
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => navigate('/drills')} className="flex-col gap-1 py-4">
          <span className="text-base">Targeted drills</span>
          <span className="text-xs font-normal text-faint">focus one weak spot</span>
        </Button>
        <Button variant="secondary" onClick={() => navigate('/analytics')} className="flex-col gap-1 py-4">
          <span className="text-base">My stats</span>
          <span className="text-xs font-normal text-faint">progress & percentile</span>
        </Button>
      </div>

      {cloudEnabled && isAnonymous && (
        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center justify-between rounded-card border border-line bg-ink-900/40 px-5 py-3.5 text-left"
        >
          <span className="text-sm text-muted">Back up your progress</span>
          <span className="text-sm font-medium text-brand">→</span>
        </button>
      )}
    </div>
  );
}
