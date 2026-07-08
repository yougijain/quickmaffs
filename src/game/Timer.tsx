export default function Timer({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(1, remaining / total));
  const secs = Math.ceil(remaining);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const low = remaining <= 10;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-xl font-semibold tabular-nums ${low ? 'text-red-400' : 'text-muted'}`}>
          {mm}:{ss.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            low ? 'bg-red-500' : 'bg-brand'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
