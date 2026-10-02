/**
 * Survey-specific form controls (Page 15).
 *
 *  - QuestionBlock: a question title + hint + inline error around any control.
 *  - ChoiceGroup:   a segmented single choice that can start EMPTY (unlike the
 *                   shared Segmented), so required questions can show an error.
 *  - ScaleChoice:   a 5-step scale with labeled ends (Local ↔ Home, Simple ↔ Extravagant).
 *  - RadioCards:    a real <fieldset>/<legend> of native radio buttons with hints.
 *
 * ChoiceGroup and ScaleChoice follow the ARIA radio-group pattern: Tab moves
 * into the group, arrow keys move the selection, Home/End jump to the ends.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Scale5, ScaleDef } from './vocab';

/* --------------------------------------------------------- QuestionBlock */

/** Ids a control inside a QuestionBlock uses to point at its label, hint, and error. */
export interface QuestionIds {
  labelId: string;
  describedBy: string | undefined;
}

/**
 * Wraps one question. `children` is a render function that receives the ids
 * so the control can say "I'm labeled by this title and described by that hint".
 */
export function QuestionBlock({
  id,
  title,
  hint,
  error,
  required,
  aside,
  children,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  aside?: ReactNode;
  children: (ids: QuestionIds) => ReactNode;
}) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`p15-question ${error ? 'has-error' : ''}`}>
      <div className="p15-q-head">
        <p id={labelId} className="p15-q-title">
          {title}
          {required && (
            <span className="p15-required" aria-hidden>
              {' '}
              *
            </span>
          )}
        </p>
        {aside && <span className="p15-q-aside">{aside}</span>}
      </div>
      {hint && (
        <p id={hintId} className="p15-hint">
          {hint}
        </p>
      )}
      {children({ labelId, describedBy })}
      {error && <InlineError id={errorId}>{error}</InlineError>}
    </div>
  );
}

/** Red inline error with an icon; announced by screen readers when it appears. */
export function InlineError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="field-error" role="alert">
      <AlertCircle aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------- radio-group keyboard */

/**
 * Roving focus for a custom radio group: only the selected option (or the
 * first one when nothing is selected) is in the Tab order, and arrow keys move
 * both focus and selection — the same way native radio buttons behave.
 */
function useRovingRadio<T>(values: T[], value: T | undefined, onChange: (v: T) => void) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = value === undefined ? -1 : values.indexOf(value);
  const tabIndexFor = (i: number) => (i === (selectedIndex >= 0 ? selectedIndex : 0) ? 0 : -1);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % values.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + values.length) % values.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = values.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(values[next]);
    refs.current[next]?.focus();
  };
  return { refs, tabIndexFor, onKeyDown };
}

/* ------------------------------------------------------------ ChoiceGroup */

export interface Choice<T> {
  value: T;
  label: ReactNode;
  /** Screen-reader name when `label` is visual (e.g. "$$" → "$15 to $30"). */
  ariaLabel?: string;
}

/** Segmented single choice; `value` may be undefined (nothing picked yet). */
export function ChoiceGroup<T>({
  options,
  value,
  onChange,
  ids,
  invalid,
  className = '',
}: {
  options: Choice<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  ids: QuestionIds;
  invalid?: boolean;
  className?: string;
}) {
  const { refs, tabIndexFor, onKeyDown } = useRovingRadio(
    options.map((o) => o.value),
    value,
    onChange,
  );
  return (
    <div
      role="radiogroup"
      aria-labelledby={ids.labelId}
      aria-describedby={ids.describedBy}
      aria-invalid={invalid || undefined}
      className={`p15-choice ${invalid ? 'is-invalid' : ''} ${className}`}
    >
      {options.map((o, i) => {
        const selected = value !== undefined && o.value === value;
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            tabIndex={tabIndexFor(i)}
            className={`p15-choice-btn ${selected ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ ScaleChoice */

/** A 5-step scale: five stops on a line with the two ends labeled. */
export function ScaleChoice({ scale, value, onChange, ids }: { scale: ScaleDef; value: Scale5; onChange: (v: Scale5) => void; ids: QuestionIds }) {
  const { refs, tabIndexFor, onKeyDown } = useRovingRadio(scale.order, value, onChange);
  return (
    <div className="p15-scale">
      <div role="radiogroup" aria-labelledby={ids.labelId} aria-describedby={ids.describedBy} className="p15-scale-track">
        {scale.order.map((v, i) => {
          const selected = v === value;
          return (
            <button
              key={v}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={scale.labels[v]}
              title={scale.labels[v]}
              tabIndex={tabIndexFor(i)}
              className={`p15-scale-stop ${selected ? 'is-active' : ''}`}
              onClick={() => onChange(v)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="p15-scale-dot" aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="p15-scale-ends" aria-hidden>
        <span>{scale.leftLabel}</span>
        <span>{scale.rightLabel}</span>
      </div>
      <p className="p15-scale-value">
        <span className="muted">Your pick:</span> <strong>{scale.labels[value]}</strong>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- RadioCards */

/** A real <fieldset> of native radios, each with an optional one-line hint. */
export function RadioCards<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
  required,
  layout = 'list',
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  error?: string;
  required?: boolean;
  /** 'grid' puts short options in two columns on wide screens. */
  layout?: 'list' | 'grid';
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className={`p15-fieldset ${error ? 'has-error' : ''}`}>
      <legend className="p15-q-title">
        {legend}
        {required && (
          <span className="p15-required" aria-hidden>
            {' '}
            *
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="p15-hint">
          {hint}
        </p>
      )}
      <div className={`p15-radio-list ${layout === 'grid' ? 'is-grid' : ''}`}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label key={o.value} className={`p15-radio ${checked ? 'is-checked' : ''}`}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={() => onChange(o.value)}
              />
              <span className="p15-radio-dot" aria-hidden />
              <span className="p15-radio-text">
                <span className="p15-radio-label">{o.label}</span>
                {o.hint && <span className="p15-radio-hint">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <InlineError id={errorId}>{error}</InlineError>}
    </fieldset>
  );
}
