import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useBestScore, useSettings } from '../data/hooks';
import { tierFor } from '../benchmark/tiers';
import { TierBadge, TierLadder, GoalProgress } from '../components/TierBadge';
import { Button, Card } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';

export default function Home() {
  const navigate = useNavigate();
  const settings = useSettings();
  const best = useBestScore() ?? 0;
  const start = useGameStore((s) => s.start);
  const { user, cloudEnabled } = useAuth();

  const tier = tierFor(best);
  const goal = settings?.goalScore ?? 40;

  const startClassic = () => {
    if (!settings) return;
    start(settings.config, { mode: 'classic' });
    navigate('/game');
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">QuickMaffs</h1>
          <p className="text-sm text-slate-400">Quant mental-math trainer</p>
        </div>
        <TierBadge tier={tier} />
      </header>

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Personal best</div>
            <div className="text-5xl font-black tabular-nums text-emerald-400">{best}</div>
          </div>
          <div className="text-right text-sm text-slate-400">{settings?.config.durationSec ?? 120}s drill</div>
        </div>
        <div className="mt-4">
          <TierLadder score={best} />
        </div>
        <div className="mt-4">
          <GoalProgress score={best} goal={goal} />
        </div>
      </Card>

      <Button onClick={startClassic} className="min-h-[3.5rem] text-lg">
        ▶ Start {settings?.config.durationSec ?? 120}s drill
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => navigate('/drills')}>
          🎯 Targeted drills
        </Button>
        <Button variant="secondary" onClick={() => navigate('/analytics')}>
          📊 My stats
        </Button>
      </div>

      {cloudEnabled && !user && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Sync scores across devices</span>
          <Button variant="ghost" className="min-h-0 px-3 py-1 text-sm" onClick={() => navigate('/auth')}>
            Sign in
          </Button>
        </Card>
      )}
    </div>
  );
}
