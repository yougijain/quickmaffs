import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useSettings, useWeaknesses } from '../data/hooks';
import { buildWeaknessMix } from '../analytics/drills';
import { cloneConfig } from '../engine/config';
import { Button, Card } from '../components/ui';
import { OP_LABEL, type Operation } from '../engine/types';
import { MIN_SAMPLES } from '../analytics/weakness';

export default function Drills() {
  const navigate = useNavigate();
  const settings = useSettings();
  const data = useWeaknesses(6);
  const start = useGameStore((s) => s.start);

  const canMix = data && data.ranked.length > 0;

  const startMix = () => {
    if (!settings || !data) return;
    const plan = buildWeaknessMix(settings.config, data.ranked);
    start(plan.config, { mode: 'drill', weights: plan.weights, focus: plan.focus });
    navigate('/game');
  };

  const startSingleOp = (op: Operation) => {
    if (!settings) return;
    const cfg = cloneConfig(settings.config);
    (Object.keys(cfg.ops) as Operation[]).forEach((o) => (cfg.ops[o].enabled = o === op));
    start(cfg, { mode: 'drill', focus: [OP_LABEL[op]] });
    navigate('/game');
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight">Targeted drills</h1>

      <Card>
        <h2 className="font-semibold">Weakness mix</h2>
        <p className="mt-1 text-sm text-slate-400">
          Oversamples the areas you’re slowest or most error-prone in, based on your history.
        </p>
        {canMix ? (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data!.ranked.slice(0, 4).map((r) => (
                <span key={r.stat.bucket} className="rounded-full bg-ink-800 px-2.5 py-1 text-xs text-amber-200">
                  {r.stat.label}
                </span>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={startMix}>
              Start weakness mix
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Play at least {MIN_SAMPLES}+ problems per area first — then a personalized mix unlocks.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Single operation</h2>
        <p className="mt-1 text-sm text-slate-400">Drill one operation at a time using your current ranges.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['add', 'sub', 'mul', 'div'] as Operation[]).map((op) => (
            <Button key={op} variant="secondary" onClick={() => startSingleOp(op)}>
              {OP_LABEL[op]}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Custom practice</h2>
          <p className="text-sm text-slate-400">Set your own ranges, ops & timer.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/settings')}>
          Configure
        </Button>
      </Card>
    </div>
  );
}
