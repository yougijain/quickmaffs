import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../game/useGameStore';
import { useOpStats, useSessions, useSettings, useWeaknesses } from '../data/hooks';
import { useAuth } from '../auth/AuthProvider';
import { buildFocusDrill } from '../analytics/drills';
import { Button, Card, Eyebrow, Stat } from '../components/ui';
import { TierBadge, RankBadge } from '../components/TierBadge';
import { formatDate, formatMs, pct } from '../lib/format';
import { MIN_SAMPLES } from '../analytics/weakness';
import { DistributionChart, ScoreHistoryChart } from '../components/charts';
import { ordinal, percentileFor } from '../benchmark/distribution';
import { tierFor } from '../benchmark/tiers';
import type { SessionMode } from '../engine/types';

const MODE_LABEL: Record<SessionMode, string> = {
  classic: 'Benchmark',
  adaptive: 'Training',
  drill: 'Drill',
  custom: 'Custom',
};

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

/** Calm practice-activity grid: last 12 weeks, shaded by problems solved/day. */
function ActivityGrid({ byDay }: { byDay: Map<string, number> }) {
  const days = 7 * 12;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  // align to the start of that week (Sunday)
  start.setDate(start.getDate() - start.getDay());

  const cells: { key: string; count: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    cells.push({ key, count: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const max = Math.max(4, ...cells.map((c) => c.count));
  const shade = (c: number) => {
    if (c === 0) return 'bg-ink-800';
    const r = c / max;
    if (r > 0.66) return 'bg-brand';
    if (r > 0.33) return 'bg-brand/60';
    return 'bg-brand/30';
  };

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: '1fr' }}>
      {cells.map((c) => (
        <div
          key={c.key}
          className={`aspect-square w-full rounded-[3px] ${shade(c.count)}`}
          title={`${c.key}: ${c.count}`}
        />
      ))}
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const data = useWeaknesses(6);
  const opStats = useOpStats();
  const sessions = useSessions() ?? [];
  const settings = useSettings();
  const start = useGameStore((s) => s.start);
  const { cloudEnabled, user, isAnonymous, backUpToEmail, setPassword, signInWithPassword, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<'backup' | 'signin'>('backup');
  const [email, setEmail] = useState('');
  const [password, setPwd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  // Only standard 120s classic runs are apples-to-apples with the population
  // benchmark, so progress/percentile/rank use those.
  const classicRuns = useMemo(
    () =>
      sessions
        .filter((s) => s.mode === 'classic' && s.durationSec === 120)
        .sort((a, b) => a.startedAt - b.startedAt),
    [sessions],
  );

  const stats = useMemo(() => {
    let problems = 0;
    let attempts = 0;
    let timeMs = 0;
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      problems += s.correct ?? s.score ?? 0;
      attempts += s.totalAttempts ?? 0;
      timeMs += s.endedAt && s.startedAt ? s.endedAt - s.startedAt : (s.durationSec ?? 0) * 1000;
      const day = new Date(s.startedAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (s.correct ?? s.score ?? 0));
    }
    const bestClassic = classicRuns.reduce((m, s) => Math.max(m, s.score), 0);
    const avgClassic = classicRuns.length
      ? Math.round(classicRuns.reduce((sum, s) => sum + s.score, 0) / classicRuns.length)
      : 0;
    const accuracy = attempts > 0 ? problems / attempts : 0;
    return { problems, attempts, timeMs, byDay, bestClassic, avgClassic, accuracy, count: sessions.length };
  }, [sessions, classicRuns]);

  const goal = settings?.goalScore ?? 40;
  const tier = tierFor(stats.bestClassic);

  const drillBucket = (bucket: string) => {
    if (!settings) return;
    const plan = buildFocusDrill(settings.config, bucket, 120);
    start(plan.config, { mode: 'drill', focus: plan.focus.map(labelFor) });
    navigate('/game');
  };

  const labelFor = (b: string) => data?.stats.find((s) => s.bucket === b)?.label ?? b;

  const submitAuth = async () => {
    if (!email || password.length < 6) {
      return setMsg('Enter your email and a password (6+ characters).');
    }
    setBusy(true);
    setMsg(null);
    const err =
      authMode === 'backup'
        ? await backUpToEmail(email.trim(), password)
        : await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (err) setMsg(err);
    else {
      setPwd('');
      setMsg(
        authMode === 'backup'
          ? 'Backed up — you can now sign in with this email + password on any device.'
          : 'Signed in — your history is downloading.',
      );
    }
  };

  const doSetPassword = async () => {
    if (newPwd.length < 6) return setPwdMsg('Use at least 6 characters.');
    setBusy(true);
    setPwdMsg(null);
    const err = await setPassword(newPwd);
    setBusy(false);
    setNewPwd('');
    setPwdMsg(err ?? 'Password saved — use it to sign in on other devices.');
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Your stats</h1>
          <p className="text-sm text-muted">
            {user?.email ?? 'Guest'}
            {(!cloudEnabled || !user || isAnonymous) && (
              <span className="text-faint">
                {' '}
                · {!cloudEnabled || !user ? 'stored on this device' : 'not backed up yet'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TierBadge tier={tier} />
          <RankBadge score={stats.bestClassic} />
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Best" value={stats.bestClassic || '—'} />
          <Stat label="Average" value={stats.avgClassic || '—'} />
          <Stat label="Pace" value={opStats?.overallMedianMs ? formatMs(opStats.overallMedianMs) : '—'} sub="per problem" />
          <Stat label="Solved" value={stats.problems.toLocaleString()} />
          <Stat label="Trained" value={formatDuration(stats.timeMs)} />
          <Stat label="Sessions" value={stats.count} />
        </div>
      </Card>

      <Card>
        <Eyebrow>Activity · last 12 weeks</Eyebrow>
        <div className="mt-3">
          <ActivityGrid byDay={stats.byDay} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Your progress</h2>
        {classicRuns.length === 0 ? (
          <p className="text-sm text-muted">
            Play a <span className="text-fg">120s classic drill</span> to start plotting your scores over time.
          </p>
        ) : (
          <>
            <ScoreHistoryChart data={classicRuns.map((s) => ({ t: s.startedAt, score: s.score }))} goal={goal} />
            <p className="mt-1 text-xs text-faint">
              {classicRuns.length} classic run{classicRuns.length === 1 ? '' : 's'} · best{' '}
              <span className="text-gold">{stats.bestClassic}</span> · {tier.label}
            </p>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Where you stand</h2>
        {stats.bestClassic <= 0 ? (
          <p className="text-sm text-muted">
            Your best 120s score will be plotted against the population curve here.
          </p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums text-brand">
                {ordinal(percentileFor(stats.bestClassic))}
              </span>
              <span className="text-sm text-muted">
                percentile — you beat ~{Math.round(percentileFor(stats.bestClassic))}% of the field
              </span>
            </div>
            <DistributionChart score={stats.bestClassic} />
            <p className="mt-1 text-xs text-faint">
              Modeled curve (normal, μ45/σ15) calibrated to community &amp; quant-interview benchmarks — there’s no
              official Zetamac dataset. Uses your best 120s classic score.
            </p>
          </>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Weak spots</h2>
          <span className="text-xs text-faint">{data?.total ?? 0} problems logged</span>
        </div>

        {!data || data.total < MIN_SAMPLES ? (
          <p className="text-sm text-muted">
            Play a few drills — once you’ve logged enough problems, your slowest and most error-prone areas show up
            here with one-tap focus practice.
          </p>
        ) : data.ranked.length === 0 ? (
          <p className="text-sm text-brand">No clear weak spots — your speed is even across the board.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.ranked.map((r) => (
              <div key={r.stat.bucket} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-fg">{r.stat.label}</div>
                  <div className="text-xs text-muted">
                    {formatMs(r.stat.medianMs)} median
                    {r.slowness > 1 && <span className="text-gold"> · {r.slowness.toFixed(1)}× slower</span>}
                    {r.stat.errorRate > 0 && <span className="text-red-300"> · {pct(r.stat.errorRate)} errors</span>}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="min-h-0 shrink-0 px-3 py-1.5 text-sm"
                  onClick={() => drillBucket(r.stat.bucket)}
                >
                  Drill
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {cloudEnabled && (!user || isAnonymous) && (
        <Card>
          <Eyebrow>{authMode === 'backup' ? 'Back up your progress' : 'Sign in to restore'}</Eyebrow>
          <p className="mt-1 text-sm text-muted">
            {authMode === 'backup'
              ? 'Set an email + password so your history survives clearing the app and follows you to other devices.'
              : 'Enter the email + password you backed up with — your history downloads right here, no email needed.'}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="email"
              inputMode="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-fg"
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete={authMode === 'backup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPwd(e.target.value)}
              className="rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-fg"
            />
            <Button onClick={submitAuth} disabled={busy || !email || password.length < 6}>
              {authMode === 'backup' ? 'Back up account' : 'Sign in & restore'}
            </Button>
          </div>
          {msg && <p className="mt-2 text-sm text-gold">{msg}</p>}
          <button
            className="mt-3 text-xs text-faint underline"
            onClick={() => {
              setAuthMode(authMode === 'backup' ? 'signin' : 'backup');
              setMsg(null);
            }}
          >
            {authMode === 'backup' ? 'Already have an account? Sign in' : 'New here? Back up instead'}
          </button>
        </Card>
      )}

      {cloudEnabled && user && !isAnonymous && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>Account</Eyebrow>
              <p className="mt-1 text-sm text-fg">{user.email}</p>
            </div>
            <Button variant="ghost" className="min-h-0 px-3 py-1.5 text-sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-sm text-muted">Set a password to sign in on other devices (no email round-trip).</p>
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="password"
                placeholder="New password (6+ characters)"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-fg"
              />
              <Button variant="secondary" onClick={doSetPassword} disabled={busy || newPwd.length < 6}>
                Save password
              </Button>
            </div>
            {pwdMsg && <p className="mt-2 text-sm text-gold">{pwdMsg}</p>}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Eyebrow>History</Eyebrow>
          <span className="text-xs text-faint">{sessions.length} sessions</span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet — go train.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {sessions.slice(0, 50).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-fg">{MODE_LABEL[s.mode] ?? s.mode}</div>
                  <div className="text-xs text-faint">{formatDate(s.startedAt)}</div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {s.totalAttempts ? (
                    <span className="text-xs tabular-nums text-faint">{pct(s.accuracy ?? 0)}</span>
                  ) : null}
                  <span className="w-8 text-lg font-bold tabular-nums text-brand">{s.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
