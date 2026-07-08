import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card } from '../components/ui';

export default function Auth() {
  const navigate = useNavigate();
  const { cloudEnabled, user, signInWithPassword, signUp, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!cloudEnabled) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[26px] font-bold tracking-tight">Sign in</h1>
        <Card>
          <p className="text-sm text-muted">
            Cloud sync isn’t configured for this build. Everything works offline and your scores are saved on this
            device.
          </p>
        </Card>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back
        </Button>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[26px] font-bold tracking-tight">Signed in</h1>
        <Card>
          <p className="text-sm text-muted">{user.email}</p>
        </Card>
        <Button onClick={() => navigate('/')}>Done</Button>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const err = mode === 'signin' ? await signInWithPassword(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) setMsg(err);
    else if (mode === 'signup') setMsg('Check your email to confirm your account.');
    else navigate('/');
  };

  const magic = async () => {
    if (!email) return setMsg('Enter your email first.');
    setBusy(true);
    const err = await signInWithMagicLink(email);
    setBusy(false);
    setMsg(err ?? 'Magic link sent — check your email.');
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-bold tracking-tight">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
      <Card className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5"
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5"
        />
        <Button onClick={submit} disabled={busy || !email || !password}>
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </Button>
        <Button variant="ghost" onClick={magic} disabled={busy}>
          Email me a magic link
        </Button>
      </Card>

      {msg && <p className="text-sm text-gold">{msg}</p>}

      <button
        className="text-sm text-muted underline"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
      <Button variant="ghost" onClick={() => navigate('/')}>
        Continue without signing in
      </Button>
    </div>
  );
}
