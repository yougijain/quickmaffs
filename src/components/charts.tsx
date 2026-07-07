import { bellCurvePoints, ordinal, percentileFor, POPULATION } from '../benchmark/distribution';
import { TIERS } from '../benchmark/tiers';

/**
 * Bell curve of the population score model with the user's score marked and
 * their percentile shaded. Pure SVG, responsive via viewBox.
 */
export function DistributionChart({ score }: { score: number }) {
  const W = 340;
  const H = 190;
  const padL = 10;
  const padR = 10;
  const padT = 16;
  const padB = 30;
  const plotW = W - padL - padR;
  const baseline = H - padB;
  const top = padT;
  const maxX = Math.round(POPULATION.mean + 4 * POPULATION.sd); // ~105

  const sx = (s: number) => padL + (Math.max(0, Math.min(maxX, s)) / maxX) * plotW;
  const cy = (yNorm: number) => baseline - yNorm * (baseline - top);

  const pts = bellCurvePoints(140);
  const curve = pts.map((p) => `${sx(p.x).toFixed(1)},${cy(p.y).toFixed(1)}`).join(' ');

  // Shaded area left of the user's score (their percentile region).
  const left = pts.filter((p) => p.x <= score);
  const areaPath =
    left.length > 1
      ? `M ${sx(left[0].x).toFixed(1)},${baseline} ` +
        left.map((p) => `L ${sx(p.x).toFixed(1)},${cy(p.y).toFixed(1)}`).join(' ') +
        ` L ${sx(left[left.length - 1].x).toFixed(1)},${baseline} Z`
      : '';

  const pct = percentileFor(score);
  const markerX = sx(score);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Your score ${score} is at the ${ordinal(pct)} percentile of the population.`}
    >
      {/* full curve area (faint) */}
      <polygon points={`${padL},${baseline} ${curve} ${W - padR},${baseline}`} fill="#334155" opacity="0.25" />
      {/* percentile shading */}
      {areaPath && <path d={areaPath} fill="#10b981" opacity="0.35" />}
      {/* curve line */}
      <polyline points={curve} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

      {/* tier ticks */}
      {TIERS.filter((t) => t.min > 0).map((t) => (
        <g key={t.key}>
          <line x1={sx(t.min)} y1={baseline} x2={sx(t.min)} y2={baseline + 4} stroke="#475569" strokeWidth="1" />
          <text x={sx(t.min)} y={baseline + 14} textAnchor="middle" fontSize="9" fill="#64748b">
            {t.min}
          </text>
        </g>
      ))}

      {/* user marker */}
      {score > 0 && (
        <g>
          <line x1={markerX} y1={top - 4} x2={markerX} y2={baseline} stroke="#34d399" strokeWidth="2" />
          <circle cx={markerX} cy={top - 4} r="3.5" fill="#34d399" />
          <text
            x={Math.max(padL + 14, Math.min(W - padR - 14, markerX))}
            y={top - 8}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#34d399"
          >
            you: {score}
          </text>
        </g>
      )}

      <text x={padL} y={H - 4} fontSize="9" fill="#64748b">
        beginner
      </text>
      <text x={W - padR} y={H - 4} textAnchor="end" fontSize="9" fill="#64748b">
        elite
      </text>
    </svg>
  );
}

/**
 * Line chart of the user's scores over time. `data` is chronological
 * (oldest first). Renders a goal reference line and highlights the best score.
 */
export function ScoreHistoryChart({ data, goal }: { data: { t: number; score: number }[]; goal: number }) {
  const W = 340;
  const H = 170;
  const padL = 26;
  const padR = 10;
  const padT = 14;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const scores = data.map((d) => d.score);
  const best = Math.max(...scores, 0);
  const yMax = Math.max(best * 1.15, goal + 8, 40);
  const n = data.length;

  const px = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const py = (s: number) => padT + plotH - (s / yMax) * plotH;

  const line = data.map((d, i) => `${px(i).toFixed(1)},${py(d.score).toFixed(1)}`).join(' ');
  const bestIdx = scores.indexOf(best);

  const yTicks = [0, Math.round(yMax / 2), Math.round(yMax)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Your score history over time">
      {/* y gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={padL} y1={py(v)} x2={W - padR} y2={py(v)} stroke="#1e293b" strokeWidth="1" />
          <text x={padL - 5} y={py(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">
            {v}
          </text>
        </g>
      ))}

      {/* goal line */}
      {goal <= yMax && (
        <g>
          <line
            x1={padL}
            y1={py(goal)}
            x2={W - padR}
            y2={py(goal)}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.8"
          />
          <text x={W - padR} y={py(goal) - 3} textAnchor="end" fontSize="9" fill="#f59e0b">
            goal {goal}
          </text>
        </g>
      )}

      {/* area under line */}
      {n > 1 && (
        <polygon
          points={`${padL},${padT + plotH} ${line} ${W - padR},${padT + plotH}`}
          fill="#10b981"
          opacity="0.12"
        />
      )}
      {/* line */}
      {n > 1 && <polyline points={line} fill="none" stroke="#34d399" strokeWidth="2" />}

      {/* points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={px(i)}
          cy={py(d.score)}
          r={i === bestIdx ? 4 : 2.5}
          fill={i === bestIdx ? '#fbbf24' : '#34d399'}
        />
      ))}

      {/* best label */}
      {best > 0 && (
        <text x={px(bestIdx)} y={py(best) - 7} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fbbf24">
          {best}
        </text>
      )}
    </svg>
  );
}
