/**
 * Form building blocks. Every input gets a real <label>, an optional hint,
 * and an error message wired up with aria-describedby so screen readers
 * announce it.
 *
 *  <Field label="Trip title" error={errors.title} required>
 *    {(props) => <input {...props} className="input" placeholder="Bachelorette trip" />}
 *  </Field>
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import './forms.css';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  required?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null | false;
  required?: boolean;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  /** Extra content to the right of the label (e.g. "Optional", a link). */
  aside?: ReactNode;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

export function Field({ label, hint, error, required, hideLabel, aside, className = '', children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <div className={`field-label-row ${hideLabel ? 'sr-only' : ''}`}>
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden> *</span>}
        </label>
        {aside && <span className="field-aside">{aside}</span>}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {hint && !error && (
        <div id={hintId} className="field-hint">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          <AlertCircle aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Styled text input (use inside <Field>). Accepts a ref so forms can focus it. */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`input ${props.className ?? ''}`} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} className={`input textarea ${props.className ?? ''}`} />;
});

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select {...props} className={`input select ${props.className ?? ''}`}>
        {children}
      </select>
    </div>
  );
}

/** Money input with a "$" prefix. */
export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="input-affix">
      <span className="input-prefix" aria-hidden>
        $
      </span>
      <input inputMode="decimal" {...props} className={`input num ${props.className ?? ''}`} />
    </div>
  );
}

/** Checkbox with a label to its right. */
export function Checkbox({ label, description, checked, onChange, disabled, id }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; id?: string }) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <label className={`check ${disabled ? 'is-disabled' : ''}`} htmlFor={cid}>
      <input id={cid} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden>
        <Check />
      </span>
      <span className="check-text">
        <span className="check-label">{label}</span>
        {description && <span className="check-desc">{description}</span>}
      </span>
    </label>
  );
}

/** On/off switch (role="switch"). */
export function Switch({ label, checked, onChange, disabled, description }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={`switch-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="switch-text">
        <label htmlFor={id} className="switch-label">
          {label}
        </label>
        {description && <span className="check-desc">{description}</span>}
      </span>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} className={`switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

/** Segmented control for 2–4 mutually exclusive options. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', disabled }: { options: Array<{ value: T; label: ReactNode }>; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'; disabled?: boolean }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Toggle chip (for multi-select tags like dietary needs or interests). */
export function ChipToggle({ selected, onToggle, children, icon, disabled }: { selected: boolean; onToggle: () => void; children: ReactNode; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`chip-toggle ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={onToggle} disabled={disabled}>
      {selected ? <Check className="chip-check" aria-hidden /> : icon}
      <span>{children}</span>
    </button>
  );
}
