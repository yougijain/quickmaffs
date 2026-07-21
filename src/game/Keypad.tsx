import { useGameStore } from './useGameStore';
import { tapKey, tapAction, tapSolved } from '../lib/haptics';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export default function Keypad() {
  const press = useGameStore((s) => s.press);

  // Press through the store, then read the score delta to pick the haptic: a
  // completed answer gets the satisfying "solved" confirm instead of a tick.
  const onKey = (k: string, isAction: boolean) => {
    const before = useGameStore.getState().score;
    press(k);
    const solved = useGameStore.getState().score > before;
    if (solved) tapSolved();
    else if (isAction) tapAction();
    else tapKey();
  };

  return (
    <div className="grid grid-cols-3 gap-2.5 no-select">
      {KEYS.map((k) => {
        const isAction = k === 'back' || k === 'clear';
        return (
          <button
            key={k}
            onClick={() => onKey(k, isAction)}
            className={`flex min-h-[4.25rem] items-center justify-center rounded-2xl border text-[26px] font-medium tabular-nums transition-all duration-100 active:scale-[0.96] ${
              isAction
                ? 'border-line/60 bg-transparent text-muted active:bg-ink-800'
                : 'border-line bg-ink-900 text-fg active:bg-ink-800'
            }`}
            aria-label={k === 'back' ? 'backspace' : k === 'clear' ? 'clear' : k}
          >
            {k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}
          </button>
        );
      })}
    </div>
  );
}
