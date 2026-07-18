import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#3ddc97', '#e5b567', '#6fe8b4', '#7aa2ff', '#f6a5c0', '#ffffff'];

/**
 * One-shot confetti burst emanating from its center. Pure CSS animation (no
 * deps, works offline); particles fly outward, spin, and fade to nothing.
 * Mount it where you want the origin — e.g. behind a "personal best" pill.
 */
export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 45 + Math.random() * 80;
        return {
          id: i,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 18, // slight upward bias
          rot: Math.round(Math.random() * 720 - 360),
          color: COLORS[i % COLORS.length],
          delay: Math.round(Math.random() * 60),
          w: 5 + Math.random() * 5,
          h: 3 + Math.random() * 4,
        };
      }),
    [count],
  );

  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute block rounded-[1px]"
          style={
            {
              width: `${p.w}px`,
              height: `${p.h}px`,
              background: p.color,
              animationDelay: `${p.delay}ms`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
