import { useGameStore } from './useGameStore';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export default function Keypad() {
  const press = useGameStore((s) => s.press);

  return (
    <div className="grid grid-cols-3 gap-2 no-select">
      {KEYS.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="flex min-h-[4rem] items-center justify-center rounded-2xl bg-ink-800 text-2xl font-semibold text-slate-100 active:bg-ink-700 active:scale-95 transition-transform"
          aria-label={k === 'back' ? 'backspace' : k === 'clear' ? 'clear' : k}
        >
          {k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}
        </button>
      ))}
    </div>
  );
}
