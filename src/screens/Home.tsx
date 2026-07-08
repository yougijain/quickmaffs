import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useAdaptivePlan, useBestScore, useSettings } from '../data/hooks';
import { makeAdaptiveSelector } from '../analytics/adaptive';
import { DEFAULT_CONFIG, cloneConfig } from '../engine/config';
import { tierFor } from '../benchmark/tiers';
import { TierBadge, TierLadder, GoalProgress } from '../components/TierBadge';
import { Button, Card, Eyebrow } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';

export default function Home() {
  const navigate = useNavigate();
  const settings = useSettings();
  const plan = useAdaptivePlan();
  const best = useBestScore() ?? 0;
  const start = useGameStore((s) => s.start);
  const { user, cloudEnabled } = useAuth();

  const tier = tierFor(best);
  const goal = settings?.goalScore ?? 40;

  const startTraining = () => {
    if (!settings) return;
    start(settings.config, {
      mode: 'adaptive',
      selector: plan ? makeAdaptiveSelector(plan) : undefined,
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
            <div className="mt-1 text-[64px] font-bold leading-none tabular-nums text-brand">{best}</div>
          </div>
          <div className="mb-1 text-right text-xs text-faint">120s · Zetamac rules</div>
        </div>
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

      {cloudEnabled && !user && (
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center justify-between rounded-card border border-line bg-ink-900/40 px-5 py-3.5 text-left"
        >
          <span className="text-sm text-muted">Sync scores across devices</span>
          <span className="text-sm font-medium text-brand">Sign in →</span>
        </button>
      )}
    </div>
  );
}
