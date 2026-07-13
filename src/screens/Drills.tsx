import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useAdaptivePlan, useOpStats, useSettings, type OpStat } from '../data/hooks';
import { makeAdaptiveSelector } from '../analytics/adaptive';
import { buildFocusDrill } from '../analytics/drills';
import { cloneConfig } from '../engine/config';
import { Button, Card } from '../components/ui';
import { OP_LABEL, type Operation } from '../engine/types';
import { pct } from '../lib/format';

const LEVEL_STYLE: Record<OpStat['level'], string> = {
  neutral: 'border-line bg-ink-900 text-fg',
  calm: 'border-brand/30 bg-brand/10 text-fg',
  warn: 'border-gold/40 bg-gold/10 text-fg',
  weak: 'border-red-400/40 bg-red-400/10 text-fg',
};

const LEVEL_DOT: Record<OpStat['level'], string> = {
  neutral: 'bg-faint',
  calm: 'bg-brand',
  warn: 'bg-gold',
  weak: 'bg-red-400',
};

export default function Drills() {
  const navigate = useNavigate();
  const settings = useSettings();
  const plan = useAdaptivePlan();
  const opStats = useOpStats();
  const start = useGameStore((s) => s.start);

  const startAdaptive = () => {
    if (!settings || !plan) return;
    start(settings.config, {
      mode: 'adaptive',
      selector: makeAdaptiveSelector(plan),
      focus: plan.targets.slice(0, 3).map((t) => t.label),
      targetBuckets: plan.targets.map((t) => t.bucket),
    });
    navigate('/game');
  };

  const startFocus = (bucket: string, label: string) => {
    if (!settings) return;
    const focusPlan = buildFocusDrill(settings.config, bucket, 120);
    start(focusPlan.config, { mode: 'drill', focus: [label], targetBuckets: [bucket] });
    navigate('/game');
  };

  const startSingleOp = (op: Operation) => {
    if (!settings) return;
    const cfg = cloneConfig(settings.config);
    (Object.keys(cfg.ops) as Operation[]).forEach((o) => (cfg.ops[o].enabled = o === op));
    start(cfg, { mode: 'drill', focus: [OP_LABEL[op]] });
    navigate('/game');
  };

  const targets = plan?.targets ?? [];
  const hasSignal = targets.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-bold tracking-tight">Targeted drills</h1>

      <Card>
        <h2 className="font-semibold">Adaptive session</h2>
        <p className="mt-1 text-sm text-muted">
          Weights problems toward where you’re slow or error-prone, stays varied, and rebalances as you improve.
        </p>
        {hasSignal ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {targets.slice(0, 4).map((t) => (
              <span
                key={t.bucket}
                className="rounded-full border border-line bg-ink-800/70 px-2.5 py-1 text-xs text-muted"
              >
                {t.label}
                <span className="text-faint">
                  {' '}
                  · {t.errorRate > 0.05 ? pct(t.errorRate) + ' err' : `${t.rel.toFixed(1)}×`}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-faint">
            No weak spots detected yet — sessions stay fully mixed until enough data accumulates.
          </p>
        )}
        <Button className="mt-4 w-full" onClick={startAdaptive} disabled={!plan}>
          Start training
        </Button>
      </Card>

      <Card>
        <h2 className="font-semibold">Single operation</h2>
        <p className="mt-1 text-sm text-muted">Drill one operation at a time using your current ranges.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['add', 'sub', 'mul', 'div'] as Operation[]).map((op) => {
            const level = opStats?.ops[op]?.level ?? 'neutral';
            return (
              <button
                key={op}
                onClick={() => startSingleOp(op)}
                className={`flex min-h-[3.25rem] items-center justify-center rounded-2xl border text-[15px] font-medium tracking-tight transition-all duration-150 active:scale-[0.98] ${LEVEL_STYLE[level]}`}
              >
                {OP_LABEL[op]}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${LEVEL_DOT.calm}`} /> On pace
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${LEVEL_DOT.warn}`} /> Slower
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${LEVEL_DOT.weak}`} /> Weakest
          </span>
        </div>
      </Card>

      {hasSignal && (
        <Card>
          <h2 className="font-semibold">Focus one weak spot</h2>
          <p className="mt-1 text-sm text-muted">120 seconds of nothing but a single problem type.</p>
          <div className="mt-3 flex flex-col gap-2">
            {targets.slice(0, 3).map((t) => (
              <div key={t.bucket} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-fg">{t.label}</span>
                <Button
                  variant="secondary"
                  className="min-h-0 shrink-0 px-3 py-1.5 text-sm"
                  onClick={() => startFocus(t.bucket, t.label)}
                >
                  Drill
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Custom practice</h2>
          <p className="text-sm text-muted">Set your own ranges, ops & timer.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/settings')}>
          Configure
        </Button>
      </Card>
    </div>
  );
}
