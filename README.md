# QuickMaffs

A mobile-first mental-math speed trainer for **quant interviews** — a faithful
[Zetamac](https://arithmetic.zetamac.com/) clone that benchmarks your score
against what trading firms expect, finds the operations you're slowest and most
error-prone on, and generates targeted drills to fix them.

Built as an installable PWA (works on iPhone straight from Safari) and wrapped
with [Capacitor](https://capacitorjs.com/) so it can also ship to the App Store.

## Features

- **Adaptive training** (the primary loop) — problem selection is weighted
  toward where you're genuinely slow or error-prone: recency-decayed stats
  (half-life ~120 attempts), intrinsic-difficulty normalization (division is
  slower than addition for everyone, so "weak" means slower than expected *for
  that op*), a shrinkage prior so one bad answer can't hijack the mix, a
  per-bucket cap (≤30%) with a guaranteed exploration floor, and interleaving
  guards (no repeated prompts, no 3+ consecutive problems from one bucket).
  The mix rebalances session-to-session as you improve.
- **Faithful Zetamac benchmark** — a separate 120s mode locked to exact
  Zetamac defaults (add 2–100, mult 2–12 × 2–100, subtraction & division as
  exact inverses), score = # correct, auto-advance, custom on-screen keypad.
  Only benchmark runs feed the tier ladder and percentile, so scores stay
  comparable.
- **Benchmark tiers** — see where your score lands on the quant ladder:
  _Solid Start (30) · Interview-Ready (40) · Strong (50) · Elite (60+)_ — with
  goal tracking.
- **Weakness analytics** — every problem's operation, operands, correctness, and
  time-to-answer are recorded and bucketed (e.g. `÷ by 7`, `large + large`) so
  your slowest / most error-prone areas surface automatically.
- **Targeted drills** — one-tap **Focus drill** for a single weak spot,
  per-operation practice, and a fully custom mode.
- **Local-first** — works fully offline; scores live on-device. Optional
  Supabase cloud sync layers on top for cross-device history.

## Tech stack

Vite · React · TypeScript · Tailwind CSS · Zustand (game state) · Dexie /
IndexedDB (local store) · Supabase (optional auth + sync) · vite-plugin-pwa ·
Capacitor (iOS). The arithmetic engine (`src/engine`) is pure and unit-tested.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + analytics unit tests
npm run build      # type-check + production build
npm run preview    # serve the production build
```

Best previewed in a mobile viewport (Chrome DevTools device toolbar → iPhone).

## Project layout

```
src/
  engine/      pure arithmetic core (generation, buckets) + tests
  analytics/   aggregation, weakness scoring, drill generation + tests
  benchmark/   quant score tiers
  game/        zustand store, keypad, timer, problem display
  data/        Dexie store, repo, Supabase client, sync
  auth/        Supabase auth context
  screens/     Home, Game, Results, Analytics, Drills, Settings, Auth
supabase/migrations/   database schema (sessions, attempts, user_settings)
ios/           Capacitor iOS project (see ios/README.md)
scripts/gen-icons.mjs  regenerates PWA icons
```

## Optional: enable cloud sync (Supabase)

The app runs fully without this. To sync across devices:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/0001_init.sql` (SQL editor, or the
   Supabase CLI). It creates `sessions`, `attempts`, and `user_settings` with
   owner-only Row-Level Security.
3. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
4. Rebuild. Sign-in appears on Home/Settings; local scores back-fill and sync on
   login and whenever connectivity returns.

## iOS / App Store

The web build is the source of truth. To run natively you need macOS + Xcode —
see [`ios/README.md`](ios/README.md). In short: `npm run build && npx cap sync
ios && npx cap open ios`.

## Benchmarks — the numbers

On the 120s default, quant-interview guidance puts ~30 as a solid start, **40 as
interview-ready / competitive**, 50 as strong, and **60+ as elite** (top prop
desks). Firms like Jane Street, Optiver, SIG, IMC, and Citadel Securities use
timed mental-math screens; Zetamac is the community-standard proxy.
