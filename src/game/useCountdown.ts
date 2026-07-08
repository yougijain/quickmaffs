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
    const expire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      cbRef.current();
    };
    const tick = () => {
      const left = Math.max(0, (endRef.current - performance.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        expire();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // rAF is suspended in a backgrounded tab, so the drill wouldn't auto-end on
    // time. A timeout backstop + a focus/visibility check cover that gap.
    const timeout = setTimeout(expire, durationSec * 1000 + 50);
    const onVisible = () => {
      if (performance.now() >= endRef.current) expire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, durationSec]);

  return remaining;
}
