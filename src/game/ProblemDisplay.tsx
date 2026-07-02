import { useGameStore } from './useGameStore';

export default function ProblemDisplay() {
  const prompt = useGameStore((s) => s.current?.prompt ?? '');
  const input = useGameStore((s) => s.input);

  return (
    <div className="flex flex-col items-center justify-center gap-3 no-select">
      <div className="font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">{prompt}</div>
      {/* Non-input display: avoids the iOS keyboard + focus zoom entirely. */}
      <div className="flex h-16 min-w-[8rem] items-center justify-center rounded-2xl border-2 border-ink-700 bg-ink-900 px-6 font-mono text-4xl font-bold text-emerald-300 tabular-nums">
        {input || <span className="text-ink-700">·</span>}
      </div>
    </div>
  );
}
