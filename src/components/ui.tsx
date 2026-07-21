import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-ink-950 font-semibold hover:bg-brand-soft active:bg-brand-soft shadow-glow',
  secondary: 'bg-ink-800 text-fg border border-line hover:bg-ink-700 active:bg-ink-700',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-ink-800',
  danger: 'bg-transparent text-red-300 border border-red-500/30 hover:bg-red-500/10',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] tracking-tight transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section';
}) {
  return (
    <Tag className={`rounded-card border border-line bg-ink-900/60 p-5 shadow-card ${className}`}>{children}</Tag>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</span>
      <span className="text-3xl font-bold tabular-nums text-fg">{value}</span>
      {sub != null && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}

/** Small section eyebrow used above cards' content. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{children}</h2>;
}
