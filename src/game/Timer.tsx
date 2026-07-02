export default function Timer({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(1, remaining / total));
  const secs = Math.ceil(remaining);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const low = remaining <= 10;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between font-mono tabular-nums">
        <span className={`text-2xl font-bold ${low ? 'text-red-400' : 'text-slate-200'}`}>
          {mm}:{ss.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${low ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
