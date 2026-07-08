import { create } from 'zustand';
import { DEFAULT_CONFIG, cloneConfig } from '../engine/config';
import { generateProblem, type OpWeights } from '../engine/generate';
import { bucketOf } from '../engine/buckets';
import { makeLiveRng, mulberry32, type Rng } from '../engine/rng';
import type { Attempt, GameConfig, Problem, SessionMode } from '../engine/types';
import { uuid } from '../lib/uuid';
import { saveSession } from '../data/repo';
import { triggerSync } from '../data/sync';
import { median } from '../analytics/aggregate';
import { APP_VERSION } from '../lib/version';
import { platformInfo } from '../lib/platform';

type Status = 'idle' | 'running' | 'finished';

/** Optional per-session problem source (e.g. the adaptive selector). */
export type ProblemSelector = (rng: Rng) => Problem;

interface StartOptions {
  mode?: SessionMode;
  weights?: OpWeights;
  focus?: string[]; // display labels for the Game header
  targetBuckets?: string[]; // bucket keys steered toward (marks attempts targeted)
  selector?: ProblemSelector;
}

interface GameState {
  status: Status;
  config: GameConfig;
  mode: SessionMode;
  focus: string[];
  targetBuckets: string[];
  weights?: OpWeights;
  selector?: ProblemSelector;
  rng: Rng;
  sessionId: string;
  current: Problem | null;
  input: string;
  score: number;
  attempts: Attempt[];
  startedAt: number;
  problemStartedAt: number;
  firstInputAt: number | null; // when the first digit of the current problem landed
  corrections: number; // backspaces on the current problem

  start: (config: GameConfig, opts?: StartOptions) => void;
  press: (key: string) => void;
  finish: () => void;
  /** Quit early: end the session WITHOUT saving it to history. */
  abort: () => void;
  reset: () => void;
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  config: cloneConfig(DEFAULT_CONFIG),
  mode: 'classic',
  focus: [],
  targetBuckets: [],
  weights: undefined,
  rng: makeLiveRng(),
  sessionId: '',
  current: null,
  input: '',
  score: 0,
  attempts: [],
  startedAt: 0,
  problemStartedAt: 0,
  firstInputAt: null,
  corrections: 0,

  start(config, opts) {
    const rng = config.seed != null ? mulberry32(config.seed) : makeLiveRng();
    const t = nowMs();
    const first = opts?.selector ? opts.selector(rng) : generateProblem(config, rng, opts?.weights);
    set({
      status: 'running',
      config: cloneConfig(config),
      mode: opts?.mode ?? 'classic',
      focus: opts?.focus ?? [],
      targetBuckets: opts?.targetBuckets ?? [],
      weights: opts?.weights,
      selector: opts?.selector,
      rng,
      sessionId: uuid(),
      current: first,
      input: '',
      score: 0,
      attempts: [],
      startedAt: t,
      problemStartedAt: t,
      firstInputAt: null,
      corrections: 0,
    });
  },

  press(key) {
    const state = get();
    if (state.status !== 'running' || !state.current) return;

    if (key === 'back') {
      if (state.input.length > 0) {
        set({ input: state.input.slice(0, -1), corrections: state.corrections + 1 });
      }
      return;
    }
    if (key === 'clear') {
      // Only count a clear as a correction if it actually cleared something.
      if (state.input.length > 0) {
        set({ input: '', corrections: state.corrections + 1 });
      }
      return;
    }

    // digit
    const t0 = nowMs();
    const firstInputAt = state.firstInputAt ?? (state.input.length === 0 ? t0 : null);
    const next = (state.input + key).slice(0, 9); // cap runaway input
    const value = Number(next);

    if (value === state.current.answer && next.length > 0) {
      // Correct → log attempt, auto-advance (Zetamac behavior).
      const t = nowMs();
      const bucket = bucketOf(state.current);
      const attempt: Attempt = {
        id: uuid(),
        sessionId: state.sessionId,
        idx: state.attempts.length,
        op: state.current.op,
        operands: state.current.operands,
        answer: state.current.answer,
        given: value,
        correct: true,
        timeMs: Math.round(t - state.problemStartedAt),
        firstInputMs: firstInputAt != null ? Math.round(firstInputAt - state.problemStartedAt) : null,
        corrections: state.corrections,
        answerDigits: String(state.current.answer).length,
        prompt: state.current.prompt,
        bucket,
        targeted: state.targetBuckets.includes(bucket),
        ts: Date.now(),
      };
      const problem = state.selector
        ? state.selector(state.rng)
        : generateProblem(state.config, state.rng, state.weights);
      set({
        attempts: [...state.attempts, attempt],
        score: state.score + 1,
        current: problem,
        input: '',
        corrections: 0,
        problemStartedAt: t,
        firstInputAt: null,
      });
      return;
    }

    set({ input: next, firstInputAt });
  },

  finish() {
    const state = get();
    if (state.status !== 'running') return;

    // Log the in-progress problem as an unfinished (incorrect) attempt so the
    // buzzer-caught problem still contributes an error/time signal.
    const attempts = [...state.attempts];
    if (state.current && state.input.length > 0) {
      const bucket = bucketOf(state.current);
      attempts.push({
        id: uuid(),
        sessionId: state.sessionId,
        idx: attempts.length,
        op: state.current.op,
        operands: state.current.operands,
        answer: state.current.answer,
        given: Number(state.input),
        correct: false,
        timeMs: Math.round(nowMs() - state.problemStartedAt),
        firstInputMs:
          state.firstInputAt != null ? Math.round(state.firstInputAt - state.problemStartedAt) : null,
        corrections: state.corrections,
        answerDigits: String(state.current.answer).length,
        prompt: state.current.prompt,
        bucket,
        targeted: state.targetBuckets.includes(bucket),
        ts: Date.now(),
      });
    }

    set({ status: 'finished', attempts });

    // Denormalized aggregates for fast history rendering.
    const correct = attempts.filter((a) => a.correct).length;
    const total = attempts.length;
    const endedAt = Date.now();
    const ctx = platformInfo();
    void saveSession(
      {
        id: state.sessionId,
        startedAt: endedAt - Math.round(nowMs() - state.startedAt),
        endedAt,
        durationSec: state.config.durationSec,
        score: state.score,
        mode: state.mode,
        totalAttempts: total,
        correct,
        errors: total - correct,
        accuracy: total > 0 ? correct / total : 0,
        medianMs: median(attempts.filter((a) => a.correct).map((a) => a.timeMs)),
        focus: state.focus,
        seed: state.config.seed ?? null,
        config: state.config,
        appVersion: APP_VERSION,
        platform: ctx.platform,
        userAgent: ctx.userAgent,
        localHour: ctx.localHour,
        timezone: ctx.timezone,
      },
      attempts,
      null,
    ).then(() => triggerSync());
  },

  abort() {
    if (get().status !== 'running') return;
    // Discard everything — a quit session is never persisted or synced.
    get().reset();
  },

  reset() {
    set({
      status: 'idle',
      current: null,
      input: '',
      score: 0,
      attempts: [],
      selector: undefined,
      targetBuckets: [],
      firstInputAt: null,
    });
  },
}));
