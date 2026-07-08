import { OP_SYMBOL, type Attempt, type Operation, type Range } from './types';

export type Band = 'sm' | 'lo' | 'mid' | 'hi' | 'xl';

/** Coarse magnitude band for an operand in ~[2,100]. */
export function band(n: number): Band {
  if (n <= 10) return 'sm';
  if (n <= 25) return 'lo';
  if (n <= 50) return 'mid';
  if (n <= 75) return 'hi';
  return 'xl';
}

/** Nominal operand range of each band (xl is open-ended above 100 in practice). */
export const BAND_RANGE: Record<Band, Range> = {
  sm: { min: 2, max: 10 },
  lo: { min: 11, max: 25 },
  mid: { min: 26, max: 50 },
  hi: { min: 51, max: 75 },
  xl: { min: 76, max: 100 },
};

/** Bands whose nominal range overlaps `r` (xl also matches anything above 100). */
export function bandsIn(r: Range): Band[] {
  return (Object.keys(BAND_RANGE) as Band[]).filter((b) => {
    if (b === 'xl') return r.max >= 76;
    const br = BAND_RANGE[b];
    return Math.max(br.min, r.min) <= Math.min(br.max, r.max);
  });
}

const BAND_LABEL: Record<string, string> = {
  sm: '≤10',
  lo: '11–25',
  mid: '26–50',
  hi: '51–75',
  xl: '76+',
};

/**
 * Bucket an attempt into an actionable group. For mul/div the small factor
 * (2–12) is keyed explicitly so "×7" / "÷ by 7" surface as real weak spots;
 * the large operand is banded. Add/sub band both operands.
 */
export function bucketOf(a: Pick<Attempt, 'op' | 'operands'>): string {
  const [x, y] = a.operands;
  switch (a.op) {
    case 'mul': {
      const small = Math.min(x, y);
      const large = Math.max(x, y);
      return `mul:x${small}:${band(large)}`;
    }
    case 'div': {
      // right operand is the small divisor; left is the dividend
      const divisor = y;
      return `div:by${divisor}:${band(x)}`;
    }
    case 'add': {
      // symmetric: order the two bands so a+b and b+a share a bucket
      const [b1, b2] = [band(x), band(y)].sort();
      return `add:${b1}+${b2}`;
    }
    case 'sub':
      return `sub:${band(x)}-${band(y)}`;
  }
}

export function opOfBucket(bucket: string): Operation {
  return bucket.split(':')[0] as Operation;
}

/** Human-readable label for a bucket key. */
export function bucketLabel(bucket: string): string {
  const parts = bucket.split(':');
  const op = parts[0] as Operation;
  switch (op) {
    case 'mul': {
      const factor = parts[1].replace('x', '');
      return `${OP_SYMBOL.mul} ${factor} (other ${BAND_LABEL[parts[2]] ?? parts[2]})`;
    }
    case 'div': {
      const divisor = parts[1].replace('by', '');
      return `${OP_SYMBOL.div} by ${divisor} (up to ${BAND_LABEL[parts[2]] ?? parts[2]})`;
    }
    case 'add': {
      const [b1, b2] = parts[1].split('+');
      return `${OP_SYMBOL.add} (${BAND_LABEL[b1] ?? b1} & ${BAND_LABEL[b2] ?? b2})`;
    }
    case 'sub': {
      const [b1, b2] = parts[1].split('-');
      return `${OP_SYMBOL.sub} (${BAND_LABEL[b1] ?? b1} − ${BAND_LABEL[b2] ?? b2})`;
    }
  }
}
