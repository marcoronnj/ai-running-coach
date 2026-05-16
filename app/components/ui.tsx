import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function scoreTone(score?: number | null) {
  if (score === undefined || score === null) return 'text-app-muted';
  if (score >= 80) return 'text-[var(--success)]';
  if (score >= 60) return 'text-[var(--warning)]';
  return 'text-[var(--danger)]';
}

export function riskTone(risk?: string | null) {
  switch (risk?.toLowerCase()) {
    case 'basso':
      return 'text-[var(--success)] bg-[rgba(124,255,138,0.1)] border-[rgba(124,255,138,0.22)]';
    case 'medio':
      return 'text-[var(--warning)] bg-[rgba(255,216,77,0.1)] border-[rgba(255,216,77,0.22)]';
    case 'alto':
      return 'text-[var(--danger)] bg-[rgba(255,98,98,0.1)] border-[rgba(255,98,98,0.22)]';
    default:
      return 'text-app-muted bg-white/5 border-white/10';
  }
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('app-screen', className)}>
      <div className="app-container">{children}</div>
    </main>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('premium-card fade-in p-4 sm:p-5', className)}>{children}</section>;
}

export function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent-secondary">
            <Icon size={18} strokeWidth={1.8} />
          </div>
        ) : null}
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'lime' | 'cyan' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.05] text-app-muted',
    lime: 'border-[rgba(215,255,63,0.24)] bg-[rgba(215,255,63,0.1)] text-accent-primary',
    cyan: 'border-[rgba(54,252,225,0.22)] bg-[rgba(54,252,225,0.1)] text-accent-secondary',
    success: 'border-[rgba(124,255,138,0.22)] bg-[rgba(124,255,138,0.1)] text-[var(--success)]',
    warning: 'border-[rgba(255,216,77,0.22)] bg-[rgba(255,216,77,0.1)] text-[var(--warning)]',
    danger: 'border-[rgba(255,98,98,0.22)] bg-[rgba(255,98,98,0.1)] text-[var(--danger)]',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none', tones[tone])}>
      {children}
    </span>
  );
}

export function IconBox({ icon: Icon, tone = 'cyan' }: { icon: LucideIcon; tone?: 'lime' | 'cyan' | 'neutral' | 'danger' | 'warning' | 'success' }) {
  const tones = {
    lime: 'text-accent-primary',
    cyan: 'text-accent-secondary',
    neutral: 'text-app-muted',
    danger: 'text-[var(--danger)]',
    warning: 'text-[var(--warning)]',
    success: 'text-[var(--success)]',
  };

  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]', tones[tone])}>
      <Icon size={17} strokeWidth={1.8} />
    </span>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  progress,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'lime' | 'cyan' | 'danger' | 'warning' | 'success';
  progress?: number | null;
}) {
  return (
    <div className="metric-card pressable h-full p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon ? <IconBox icon={Icon} tone={tone} /> : null}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-app-text sm:text-[1.7rem]">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-snug text-app-muted">{detail}</div> : null}
      {typeof progress === 'number' ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
            style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
