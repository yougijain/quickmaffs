import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useCountdown } from '../game/useCountdown';
import Timer from '../game/Timer';
import ProblemDisplay from '../game/ProblemDisplay';
import Keypad from '../game/Keypad';
import { Button } from '../components/ui';

export default function Game() {
  const navigate = useNavigate();
  const status = useGameStore((s) => s.status);
  const score = useGameStore((s) => s.score);
  const duration = useGameStore((s) => s.config.durationSec);
  const focus = useGameStore((s) => s.focus);
  const finish = useGameStore((s) => s.finish);

  // If the user deep-links here without starting, bounce home.
  useEffect(() => {
    if (status === 'idle') navigate('/', { replace: true });
  }, [status, navigate]);

  useEffect(() => {
    if (status === 'finished') navigate('/results', { replace: true });
  }, [status, navigate]);

  const remaining = useCountdown(status === 'running', duration, finish);

  // Physical keyboard support (nice on desktop / iPad).
  useEffect(() => {
    const press = useGameStore.getState().press;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (status !== 'running') return null;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pt-safe pb-safe no-select">
      <header className="flex items-center justify-between pt-3">
        <Button variant="ghost" className="min-h-0 px-2 py-1 text-sm" onClick={finish}>
          End
        </Button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-slate-400">Score</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-400">{score}</div>
        </div>
        <div className="w-12" />
      </header>

      {focus.length > 0 && (
        <p className="mt-1 text-center text-xs text-amber-300/80">Focus: {focus.join(' · ')}</p>
      )}

      <div className="mt-3">
        <Timer remaining={remaining} total={duration} />
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <ProblemDisplay />
      </div>

      <div className="pb-2">
        <Keypad />
      </div>
    </div>
  );
}
