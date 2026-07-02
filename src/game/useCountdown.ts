import { useEffect, useRef, useState } from 'react';

/**
 * Drift-free countdown driven by requestAnimationFrame off a fixed end time.
 * Calls onExpire once when the remaining time hits zero.
 */
export function useCountdown(active: boolean, durationSec: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(durationSec);
  const endRef = useRef(0);
  const firedRef = useRef(false);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (!active) return;
    endRef.current = performance.now() + durationSec * 1000;
    firedRef.current = false;
    setRemaining(durationSec);

    let raf = 0;
    const tick = () => {
      const left = Math.max(0, (endRef.current - performance.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          cbRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, durationSec]);

  return remaining;
}
