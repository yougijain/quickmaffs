import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSessions } from '../data/hooks';
import { Button, Card, Eyebrow, Stat } from '../components/ui';
import { tierFor } from '../benchmark/tiers';
import { TierBadge } from '../components/TierBadge';
import { ordinal, percentileFor } from '../benchmark/distribution';
import { formatDate, pct } from '../lib/format';
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
        <div key={c.key} className={`aspect-square w-full rounded-[3px] ${shade(c.count)}`} title={`${c.key}: ${c.count}`} />
      ))}
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const { cloudEnabled, user, isAnonymous, backUpToEmail, setPassword, signInWithPassword, signOut } = useAuth();
  const sessions = useSessions() ?? [];
  const [busy, setBusy] = useState(false);
  // anonymous card: toggle between creating a backup and signing in
  const [authMode, setAuthMode] = useState<'backup' | 'signin'>('backup');
  const [email, setEmail] = useState('');
  const [password, setPwd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  // signed-in card: set/change password
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

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
    const bestClassic = sessions
      .filter((s) => s.mode === 'classic' && s.durationSec === 120)
      .reduce((m, s) => Math.max(m, s.score), 0);
    const accuracy = attempts > 0 ? problems / attempts : 0;
    return { problems, attempts, timeMs, byDay, bestClassic, accuracy, count: sessions.length };
  }, [sessions]);

  const tier = tierFor(stats.bestClassic);

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

  const initial = (user?.email ?? 'G').slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-ink-800 text-lg font-bold text-brand">
          {initial}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold tracking-tight">
            {user?.email ?? 'Guest'}
          </h1>
          <p className="text-xs text-muted">
            {!cloudEnabled || !user
              ? 'Stored on this device'
              : isAnonymous
                ? 'Synced to cloud · not backed up yet'
                : 'Synced & backed up'}
          </p>
        </div>
        <div className="ml-auto">
          <TierBadge tier={tier} />
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Benchmark best" value={stats.bestClassic} sub={tier.label} />
          <Stat
            label="Percentile"
            value={stats.bestClassic > 0 ? ordinal(percentileFor(stats.bestClassic)) : '—'}
          />
          <Stat label="Problems solved" value={stats.problems.toLocaleString()} />
          <Stat label="Time trained" value={formatDuration(stats.timeMs)} />
          <Stat label="Sessions" value={stats.count} />
          <Stat label="Accuracy" value={stats.attempts > 0 ? pct(stats.accuracy) : '—'} />
        </div>
      </Card>

      <Card>
        <Eyebrow>Activity · last 12 weeks</Eyebrow>
        <div className="mt-3">
          <ActivityGrid byDay={stats.byDay} />
        </div>
      </Card>

      {cloudEnabled && isAnonymous && (
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

      {cloudEnabled && !isAnonymous && (
        <Card>
          <Eyebrow>Password</Eyebrow>
          <p className="mt-1 text-sm text-muted">
            Set a password to sign in on other devices (no email round-trip).
          </p>
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
            {sessions.slice(0, 100).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-sm text-fg">{MODE_LABEL[s.mode] ?? s.mode}</div>
                  <div className="text-xs text-faint">{formatDate(s.startedAt)}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
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

      <div className="flex flex-col gap-2 pb-2">
        {cloudEnabled && !isAnonymous && (
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    </div>
  );
}
