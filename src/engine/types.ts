export type Operation = 'add' | 'sub' | 'mul' | 'div';

export const OPERATIONS: Operation[] = ['add', 'sub', 'mul', 'div'];

export const OP_SYMBOL: Record<Operation, string> = {
  add: '+',
  sub: '−', // minus sign
  mul: '×', // multiplication sign
  div: '÷', // division sign
};

export const OP_LABEL: Record<Operation, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  mul: 'Multiplication',
  div: 'Division',
};

export interface Range {
  min: number;
  max: number;
}

export interface OpConfig {
  enabled: boolean;
  /**
   * For add/sub these are the two addend ranges of the underlying addition.
   * For mul/div these are the two factor ranges of the underlying multiplication
   * (by Zetamac convention `a` is the small 2-12 factor).
   */
  a: Range;
  b: Range;
}

export type SessionMode = 'classic' | 'adaptive' | 'drill' | 'custom';

export interface GameConfig {
  durationSec: number;
  ops: Record<Operation, OpConfig>;
  /** Optional seed for reproducible sessions (used by tests + focus drills). */
  seed?: number;
}

export interface Problem {
  id: string;
  op: Operation;
  /** The operands exactly as displayed, left to right. */
  operands: [number, number];
  answer: number; // always a non-negative integer
  prompt: string; // e.g. "37 + 88"
}

export interface Attempt {
  id: string;
  sessionId: string;
  idx: number; // position within the session (0-based)
  op: Operation;
  operands: [number, number];
  answer: number;
  given: number | null; // null if unanswered when the buzzer sounded
  correct: boolean;
  timeMs: number; // total time-to-answer for this problem
  firstInputMs: number | null; // time to the first keypress (reaction vs compute)
  corrections: number; // backspaces used — a soft error/uncertainty signal
  prompt: string;
  bucket: string;
  targeted: boolean; // adaptively steered toward a weak bucket
  ts: number; // epoch ms
}
