import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-emerald-500 text-ink-950 hover:bg-emerald-400 active:bg-emerald-600',
  secondary: 'bg-ink-800 text-slate-100 hover:bg-ink-700 active:bg-ink-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-ink-800',
  danger: 'bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-colors disabled:opacity-40 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-ink-800 bg-ink-900/70 p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      {sub != null && <span className="text-sm text-slate-400">{sub}</span>}
    </div>
  );
}
