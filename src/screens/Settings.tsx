import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../data/hooks';
import { saveSettings } from '../data/repo';
import { DEFAULT_CONFIG, cloneConfig } from '../engine/config';
import { gameConfigSchema } from '../engine/schema';
import { OP_LABEL, type GameConfig, type Operation } from '../engine/types';
import { Button, Card } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useGameStore } from '../game/useGameStore';

export default function Settings() {
  const navigate = useNavigate();
  const settings = useSettings();
  const { user, cloudEnabled, signOut } = useAuth();
  const start = useGameStore((s) => s.start);

  const [config, setConfig] = useState<GameConfig | null>(null);
  const [goal, setGoal] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && !config) {
      setConfig(cloneConfig(settings.config));
      setGoal(settings.goalScore);
    }
  }, [settings, config]);

  if (!config) return <p className="text-slate-400">Loading…</p>;

  const update = (fn: (c: GameConfig) => void) => {
    const next = cloneConfig(config);
    fn(next);
    setConfig(next);
    setSaved(false);
  };

  const validateAndGet = (): GameConfig | null => {
    const result = gameConfigSchema.safeParse(config);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid settings');
      return null;
    }
    setError(null);
    return config;
  };

  const save = async () => {
    const valid = validateAndGet();
    if (!valid) return;
    await saveSettings(valid, goal);
    setSaved(true);
  };

  const playCustom = async () => {
    const valid = validateAndGet();
    if (!valid) return;
    await saveSettings(valid, goal);
    start(valid, { mode: 'custom' });
    navigate('/game');
  };

  const resetDefaults = () => {
    setConfig(cloneConfig(DEFAULT_CONFIG));
    setSaved(false);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight">Settings</h1>

      <Card>
        <label className="flex items-center justify-between">
          <span className="font-medium">Timer</span>
          <span className="flex items-center gap-2">
            <NumberInput value={config.durationSec} onChange={(v) => update((c) => (c.durationSec = v))} />
            <span className="text-sm text-slate-400">sec</span>
          </span>
        </label>
        <div className="mt-3 flex gap-2">
          {[60, 120, 300].map((d) => (
            <Button
              key={d}
              variant={config.durationSec === d ? 'primary' : 'secondary'}
              className="min-h-0 flex-1 px-2 py-1.5 text-sm"
              onClick={() => update((c) => (c.durationSec = d))}
            >
              {d < 120 ? `${d}s` : `${d / 60}m`}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <label className="flex items-center justify-between">
          <span className="font-medium">Goal score</span>
          <NumberInput value={goal} onChange={setGoal} />
        </label>
      </Card>

      {(['add', 'sub', 'mul', 'div'] as Operation[]).map((op) => (
        <Card key={op}>
          <label className="flex items-center justify-between">
            <span className="font-semibold">{OP_LABEL[op]}</span>
            <input
              type="checkbox"
              className="h-6 w-6 accent-emerald-500"
              checked={config.ops[op].enabled}
              onChange={(e) => update((c) => (c.ops[op].enabled = e.target.checked))}
            />
          </label>
          {config.ops[op].enabled && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <RangeRow
                label={op === 'mul' || op === 'div' ? 'Factor A' : 'Term A'}
                range={config.ops[op].a}
                onChange={(r) => update((c) => (c.ops[op].a = r))}
              />
              <RangeRow
                label={op === 'mul' || op === 'div' ? 'Factor B' : 'Term B'}
                range={config.ops[op].b}
                onChange={(r) => update((c) => (c.ops[op].b = r))}
              />
            </div>
          )}
        </Card>
      ))}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Saved ✓</p>}

      <div className="flex flex-col gap-2">
        <Button onClick={playCustom}>Play with these settings</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={save}>
            Save
          </Button>
          <Button variant="ghost" onClick={resetDefaults}>
            Reset to Zetamac defaults
          </Button>
        </div>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Account</h2>
        {!cloudEnabled ? (
          <p className="text-sm text-slate-400">
            Cloud sync isn’t configured. The app works fully offline; scores are stored on this device.
          </p>
        ) : user ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">{user.email}</span>
            <Button variant="ghost" className="min-h-0 px-3 py-1 text-sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/auth')}>
            Sign in to sync
          </Button>
        )}
      </Card>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-right tabular-nums"
    />
  );
}

function RangeRow({
  label,
  range,
  onChange,
}: {
  label: string;
  range: { min: number; max: number };
  onChange: (r: { min: number; max: number }) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      <div className="flex items-center gap-1">
        <NumberInput value={range.min} onChange={(v) => onChange({ ...range, min: v })} />
        <span className="text-slate-500">–</span>
        <NumberInput value={range.max} onChange={(v) => onChange({ ...range, max: v })} />
      </div>
    </div>
  );
}
