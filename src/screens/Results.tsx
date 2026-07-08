import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { tierFor } from '../benchmark/tiers';
import { TierBadge, TierLadder } from '../components/TierBadge';
import { Button, Card, Stat } from '../components/ui';
import { OP_LABEL, type Operation } from '../engine/types';
import { median } from '../analytics/aggregate';
import { formatMs } from '../lib/format';
import { DistributionChart } from '../components/charts';
import { ordinal, percentileFor } from '../benchmark/distribution';

export default function Results() {
  const navigate = useNavigate();
  const attempts = useGameStore((s) => s.attempts);
  const score = useGameStore((s) => s.score);
  const config = useGameStore((s) => s.config);
  const mode = useGameStore((s) => s.mode);
  const weights = useGameStore((s) => s.weights);
  const focus = useGameStore((s) => s.focus);
  const start = useGameStore((s) => s.start);

  const tier = tierFor(score);

  const byOp = useMemo(() => {
    const ops: Operation[] = ['add', 'sub', 'mul', 'div'];
    return ops
      .map((op) => {
        const rows = attempts.filter((a) => a.op === op && a.correct);
        return {
          op,
          count: rows.length,
          medianMs: median(rows.map((r) => r.timeMs)),
        };
      })
      .filter((r) => r.count > 0);
  }, [attempts]);

  const correct = attempts.filter((a) => a.correct).length;
  const errors = attempts.length - correct;
  const avgMs = median(attempts.filter((a) => a.correct).map((a) => a.timeMs));

  const playAgain = () => {
    start(config, { mode, weights, focus });
    navigate('/game', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 pt-safe pb-safe">
      <div className="pt-6 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Final Score</div>
        <div className="text-7xl font-black tabular-nums text-brand">{score}</div>
        <div className="mt-2 flex justify-center">
          <TierBadge tier={tier} large />
        </div>
        <p className="mt-2 text-sm text-muted">{tier.blurb}</p>
      </div>

      <Card>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Benchmark ladder</div>
        <TierLadder score={score} />
      </Card>

      {mode === 'classic' && config.durationSec === 120 && score > 0 && (
        <Card>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Where you stand</span>
          </div>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tracking-tight tabular-nums text-brand">{ordinal(percentileFor(score))}</span>
            <span className="text-sm text-muted">percentile · beat ~{Math.round(percentileFor(score))}% of the field</span>
          </div>
          <DistributionChart score={score} />
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Correct" value={correct} />
          <Stat label="Errors" value={errors} />
          <Stat label="Median" value={formatMs(avgMs)} />
        </div>
      </Card>

      {byOp.length > 0 && (
        <Card>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">By operation</div>
          <div className="flex flex-col gap-2">
            {byOp.map((r) => (
              <div key={r.op} className="flex items-center justify-between text-sm">
                <span className="text-muted">{OP_LABEL[r.op]}</span>
                <span className="tabular-nums text-muted">
                  {r.count} · {formatMs(r.medianMs)} median
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-auto flex flex-col gap-2 pb-4">
        <Button onClick={playAgain}>Play again</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => navigate('/analytics')}>
            View stats
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
