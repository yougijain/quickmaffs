import { create } from 'zustand';
import { DEFAULT_CONFIG, cloneConfig } from '../engine/config';
import { generateProblem, type OpWeights } from '../engine/generate';
import { bucketOf } from '../engine/buckets';
import { makeLiveRng, mulberry32, type Rng } from '../engine/rng';
import type { Attempt, GameConfig, Problem, SessionMode } from '../engine/types';
import { uuid } from '../lib/uuid';
import { saveSession } from '../data/repo';
import { triggerSync } from '../data/sync';

type Status = 'idle' | 'running' | 'finished';

interface StartOptions {
  mode?: SessionMode;
  weights?: OpWeights;
  focus?: string[];
}

interface GameState {
  status: Status;
  config: GameConfig;
  mode: SessionMode;
  focus: string[];
  weights?: OpWeights;
  rng: Rng;
  sessionId: string;
  current: Problem | null;
  input: string;
  score: number;
  attempts: Attempt[];
  startedAt: number;
  problemStartedAt: number;
  corrections: number; // backspaces on the current problem

  start: (config: GameConfig, opts?: StartOptions) => void;
  press: (key: string) => void;
  finish: () => void;
  reset: () => void;
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  config: cloneConfig(DEFAULT_CONFIG),
  mode: 'classic',
  focus: [],
  weights: undefined,
  rng: makeLiveRng(),
  sessionId: '',
  current: null,
  input: '',
  score: 0,
  attempts: [],
  startedAt: 0,
  problemStartedAt: 0,
  corrections: 0,

  start(config, opts) {
    const rng = config.seed != null ? mulberry32(config.seed) : makeLiveRng();
    const t = nowMs();
    const first = generateProblem(config, rng, opts?.weights);
    set({
      status: 'running',
      config: cloneConfig(config),
      mode: opts?.mode ?? 'classic',
      focus: opts?.focus ?? [],
      weights: opts?.weights,
      rng,
      sessionId: uuid(),
      current: first,
      input: '',
      score: 0,
      attempts: [],
      startedAt: t,
      problemStartedAt: t,
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
      set({ input: '', corrections: state.corrections + 1 });
      return;
    }

    // digit
    const next = (state.input + key).slice(0, 9); // cap runaway input
    const value = Number(next);

    if (value === state.current.answer && next.length > 0) {
      // Correct → log attempt, auto-advance (Zetamac behavior).
      const t = nowMs();
      const attempt: Attempt = {
        id: uuid(),
        sessionId: state.sessionId,
        op: state.current.op,
        operands: state.current.operands,
        answer: state.current.answer,
        given: value,
        correct: true,
        timeMs: Math.round(t - state.problemStartedAt),
        corrections: state.corrections,
        bucket: bucketOf(state.current),
        ts: Date.now(),
      };
      const problem = generateProblem(state.config, state.rng, state.weights);
      set({
        attempts: [...state.attempts, attempt],
        score: state.score + 1,
        current: problem,
        input: '',
        corrections: 0,
        problemStartedAt: t,
      });
      return;
    }

    set({ input: next });
  },

  finish() {
    const state = get();
    if (state.status !== 'running') return;

    // Log the in-progress problem as an unfinished (incorrect) attempt so the
    // buzzer-caught problem still contributes an error/time signal.
    const attempts = [...state.attempts];
    if (state.current && state.input.length > 0) {
      attempts.push({
        id: uuid(),
        sessionId: state.sessionId,
        op: state.current.op,
        operands: state.current.operands,
        answer: state.current.answer,
        given: Number(state.input),
        correct: false,
        timeMs: Math.round(nowMs() - state.problemStartedAt),
        corrections: state.corrections,
        bucket: bucketOf(state.current),
        ts: Date.now(),
      });
    }

    set({ status: 'finished', attempts });

    // Persist locally then push to cloud (both no-op-safe if unconfigured).
    void saveSession(
      {
        id: state.sessionId,
        startedAt: Date.now() - Math.round(nowMs() - state.startedAt),
        durationSec: state.config.durationSec,
        score: state.score,
        mode: state.mode,
        config: state.config,
      },
      attempts,
      null,
    ).then(() => triggerSync());
  },

  reset() {
    set({ status: 'idle', current: null, input: '', score: 0, attempts: [] });
  },
}));
