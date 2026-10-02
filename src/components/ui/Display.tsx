/**
 * Small display components: badges, role badges, demo labels, avatars,
 * banners, empty states, skeletons, and inline lock notes.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Lock, XCircle } from 'lucide-react';
import type { Person, Role } from '../../data/types';
import { initials } from '../../lib/format';
import { ROLE_LABEL } from '../../lib/permissions';
import './display.css';

/* ------------------------------------------------------------------ badges */

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone = 'neutral', icon, children, className = '' }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

export function RoleBadge({ role, days }: { role: Role; days?: number }) {
  return (
    <span className={`badge role-badge role-${role}`}>
      {ROLE_LABEL[role]}
      {role === 'day' && days !== undefined ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}
    </span>
  );
}

/**
 * Marks anything simulated or illustrative so testers never mistake it for a
 * live integration: "Simulated", "Demo data", "Estimate".
 */
export function DemoBadge({ children = 'Simulated', title }: { children?: ReactNode; title?: string }) {
  return (
    <span className="badge demo-badge" title={title ?? 'Prototype: this is simulated, not a live integration'}>
      <FlaskConical aria-hidden />
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- avatars */

export function Avatar({ person, size = 32, ring }: { person: Pick<Person, 'name' | 'color'>; size?: number; ring?: boolean }) {
  return (
    <span
      className={`avatar ${ring ? 'avatar-ring' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: `var(--${person.color}, var(--av-8))` }}
      title={person.name}
      aria-label={person.name}
      role="img"
    >
      {initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 28 }: { people: Array<Pick<Person, 'name' | 'color' | 'id'>>; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack" aria-label={people.map((p) => p.name).join(', ')} role="group">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} ring />
      ))}
      {extra > 0 && (
        <span className="avatar avatar-more avatar-ring" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ----------------------------------------------------------------- banners */

const TONE_ICON: Record<string, ReactNode> = {
  info: <Info aria-hidden />,
  success: <CheckCircle2 aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  danger: <XCircle aria-hidden />,
  locked: <Lock aria-hidden />,
  demo: <FlaskConical aria-hidden />,
};

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  icon,
  className = '',
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'locked' | 'demo';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`banner banner-${tone} ${className}`} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>
      <span className="banner-icon">{icon ?? TONE_ICON[tone]}</span>
      <div className="banner-body">
        {title && <p className="banner-title">{title}</p>}
        {children && <div className="banner-text">{children}</div>}
      </div>
      {action && <div className="banner-action">{action}</div>}
    </div>
  );
}

/** Inline "why is this locked" note, e.g. under a disabled form. */
export function LockNote({ children }: { children: ReactNode }) {
  return (
    <p className="lock-note">
      <Lock aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({ icon, title, children, actions, compact }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? 'is-compact' : ''}`}>
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {children && <div className="empty-text">{children}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- loading */

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden />;
}

/** A loading region with an accessible label. */
export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="loading-region">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- sections */

/** A titled section with optional actions on the right. */
export function Section({ title, eyebrow, actions, children, className = '', id }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`section ${className}`} id={id} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div className="section-head">
          <div className="stack-xs">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && (
              <h2 className="section-title" id={id ? `${id}-title` : undefined}>
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
