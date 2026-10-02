/**
 * Button — the one button component used everywhere.
 *
 *  <Button onClick={save}>Save</Button>
 *  <Button to={paths.newTrip()} variant="secondary" icon={<Plus />}>New trip</Button>
 *  <Button locked="Only Maya can edit this trip">Edit</Button>
 *
 * `locked` renders a visibly locked control. Tapping it shows the reason in a
 * toast instead of doing nothing — that's how Viewers learn why they can't edit
 * (works on touch screens, where hover tooltips don't).
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Link } from '../../router/router';
import { toast } from '../../store/toast';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  /** In-app path → renders an <a>. */
  to?: string;
  /** External URL → renders an <a target=_blank>. */
  href?: string;
  /** Reason the action is unavailable (permission or state). */
  locked?: string | false;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, iconRight, loading, to, href, locked, className = '', children, onClick, type = 'button', disabled, ...rest },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', locked ? 'is-locked' : '', className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <Loader2 className="btn-icon spin" aria-hidden /> : locked ? <Lock className="btn-icon" aria-hidden /> : icon ? <span className="btn-icon">{icon}</span> : null}
      {children !== undefined && <span className="btn-label">{children}</span>}
      {iconRight && !loading && <span className="btn-icon">{iconRight}</span>}
    </>
  );

  if (to && !locked && !disabled) {
    return (
      <Link to={to} className={classes} aria-label={rest['aria-label']}>
        {content}
      </Link>
    );
  }
  if (href && !locked && !disabled) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes} aria-label={rest['aria-label']}>
        {content}
      </a>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-disabled={locked ? true : undefined}
      aria-busy={loading || undefined}
      title={locked || rest.title}
      onClick={(e) => {
        if (locked) {
          e.preventDefault();
          toast({ title: 'Not available', body: locked, tone: 'info' });
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {content}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Required: icon-only buttons need a text label for screen readers. */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'secondary' | 'primary' | 'overlay';
  size?: ButtonSize;
  to?: string;
  locked?: string | false;
}

/** Square icon-only button (menu, close, more). */
export function IconButton({ label, icon, variant = 'ghost', size = 'md', to, locked, className = '', onClick, ...rest }: IconButtonProps) {
  const classes = ['icon-btn', `icon-btn-${variant}`, `icon-btn-${size}`, locked ? 'is-locked' : '', className].filter(Boolean).join(' ');
  if (to && !locked) {
    return (
      <Link to={to} className={classes} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={locked || label}
      aria-disabled={locked ? true : undefined}
      onClick={(e) => {
        if (locked) {
          toast({ title: 'Not available', body: locked, tone: 'info' });
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {locked ? <Lock aria-hidden /> : icon}
    </button>
  );
}
