import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { tierFor } from '../benchmark/tiers';
import { TierBadge, TierLadder, NewBestPill } from '../components/TierBadge';
import { Button, Card, Stat } from '../components/ui';
import { OP_LABEL, type Operation } from '../engine/types';
import { median } from '../analytics/aggregate';
import { formatMs } from '../lib/format';
import { DistributionChart } from '../components/charts';
import { ordinal, percentileFor } from '../benchmark/distribution';
import { useAdaptivePlan, useSessions } from '../data/hooks';
import { makeAdaptiveSelector } from '../analytics/adaptive';
import { pct } from '../lib/format';
import { deleteSession } from '../data/repo';
import { deleteRemoteSession } from '../data/sync';
import { Confetti } from '../components/Confetti';

export default function Results() {
  const navigate = useNavigate();
  const status = useGameStore((s) => s.status);
  const attempts = useGameStore((s) => s.attempts);
  const score = useGameStore((s) => s.score);
  const config = useGameStore((s) => s.config);
  const mode = useGameStore((s) => s.mode);
  const weights = useGameStore((s) => s.weights);
  const focus = useGameStore((s) => s.focus);
  const sessionId = useGameStore((s) => s.sessionId);
  const start = useGameStore((s) => s.start);
  const reset = useGameStore((s) => s.reset);
  // Live plan — recomputes once this session's attempts land in Dexie, so it
  // already reflects the run you just finished.
  const plan = useAdaptivePlan();
  const sessions = useSessions() ?? [];

  // New personal best: beats every prior run of the same mode + duration.
  const priorBest = sessions
    .filter((s) => s.id !== sessionId && s.mode === mode && s.durationSec === config.durationSec)
    .reduce((m, s) => Math.max(m, s.score), 0);
  const priorCount = sessions.filter(
    (s) => s.id !== sessionId && s.mode === mode && s.durationSec === config.durationSec,
  ).length;
  const isNewBest = score > 0 && priorCount > 0 && score > priorBest;

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
    // Adaptive sessions rebuild the selector from the freshest plan — that is
    // the loop: play, weights shift, play again.
    if (mode === 'adaptive') {
      start(config, {
        mode,
        selector: plan ? makeAdaptiveSelector(plan) : undefined,
        focus: plan?.targets.slice(0, 3).map((t) => t.label) ?? [],
        targetBuckets: plan?.targets.map((t) => t.bucket) ?? [],
      });
    } else {
      start(config, { mode, weights, focus });
    }
    navigate('/game', { replace: true });
  };

  // Discard an interrupted/fluke run so it doesn't pollute your stats. The
  // session was already saved on finish, so this removes it locally + in cloud.
  const discardRun = async () => {
    if (!window.confirm('Discard this run? It won’t count toward your stats or history.')) return;
    const id = sessionId;
    reset();
    await deleteSession(id);
    void deleteRemoteSession(id);
    navigate('/', { replace: true });
  };

  const nextTargets = plan?.targets.slice(0, 3) ?? [];

  // A reload keeps the #/results hash but resets the in-memory store to idle —
  // bounce home instead of painting a bogus "Final Score 0".
  useEffect(() => {
    if (status === 'idle') navigate('/', { replace: true });
  }, [status, navigate]);

  if (status === 'idle') return null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 px-4 pt-safe pb-safe">
      <div className="pt-6 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Final Score</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-7xl font-black tabular-nums text-brand">{score}</span>
        </div>
        {isNewBest && (
          <div className="relative mt-2 flex justify-center">
            <Confetti />
            <span className="pb-pop relative z-10">
              <NewBestPill />
            </span>
          </div>
        )}
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

      {mode === 'adaptive' && (
        <Card>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Next session targets
          </div>
          {nextTargets.length === 0 ? (
            <p className="text-sm text-muted">No clear weak spots — the next session stays fully mixed.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {nextTargets.map((t) => (
                <div key={t.bucket} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{t.label}</span>
                  <span className="tabular-nums text-faint">
                    {t.errorRate > 0.05 ? `${pct(t.errorRate)} errors` : `${t.rel.toFixed(1)}× expected time`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
        <Button onClick={playAgain}>{mode === 'adaptive' ? 'Train again' : 'Play again'}</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => navigate('/analytics')}>
            View stats
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
        {/* Interrupted or fluke run? Drop it so it doesn't skew your stats. */}
        <div className="mt-1 flex justify-center">
          <button
            onClick={discardRun}
            className="rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 active:scale-95"
          >
            Discard this run
          </button>
        </div>
      </div>
    </div>
  );
}
