import { useGameStore } from './useGameStore';

export default function ProblemDisplay() {
  const prompt = useGameStore((s) => s.current?.prompt ?? '');
  const input = useGameStore((s) => s.input);

  return (
    <div className="flex flex-col items-center justify-center gap-6 no-select">
      <div className="text-center text-[56px] font-semibold leading-none tracking-tight tabular-nums text-fg sm:text-6xl">
        {prompt}
      </div>
      {/* Non-input display: avoids the iOS keyboard + focus zoom entirely. */}
      <div className="flex h-14 min-w-[7rem] items-center justify-center px-4 text-[40px] font-bold leading-none tabular-nums text-brand">
        {input || <span className="text-faint/50">–</span>}
      </div>
    </div>
  );
}
