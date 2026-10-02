/**
 * Destination picker (Page 6): a searchable city "combobox" plus the chosen
 * destinations as numbered, removable chips (the order is the route; the
 * first one sets the cover photo).
 *
 * Accessibility follows the WAI-ARIA combobox pattern:
 *   ↓ / ↑ move through results · Enter adds the highlighted one · Escape closes.
 * The highlighted option is announced through `aria-activedescendant`, so
 * keyboard focus never leaves the text box.
 *
 * Live search uses Photon (OpenStreetMap). If it's unreachable, `searchCities`
 * falls back to a bundled list of popular cities and we say so. People can also
 * add whatever they typed (a small town, "Grandma's cabin").
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Loader2, MapPin, MapPinOff, Plus, Search, WifiOff, X } from 'lucide-react';
import type { Destination } from '../../data/types';
import type { FieldControlProps } from '../../components/ui/Field';
import { searchCities } from '../../services/places';

/** One row in the results list: a found city, or "add what I typed". */
type CityOption = { kind: 'city'; dest: Destination; added: boolean } | { kind: 'custom'; name: string };

/** Same place? Different search sources give the same city different ids. */
function sameDest(a: Destination, b: Destination): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && (a.country ?? '').toLowerCase() === (b.country ?? '').toLowerCase();
}

/** A typed-in place we couldn't put on the map (no coordinates found). */
export function isUnmapped(d: Destination): boolean {
  return d.lat === 0 && d.lng === 0;
}

export interface CitySearchProps {
  value: Destination[];
  onChange: (next: Destination[]) => void;
  /** id / aria props from <Field> so the label and error point at the text box. */
  control: FieldControlProps;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/** The searchable destination picker with numbered chips (see the file comment). */
export function CitySearch({ value, onChange, control, inputRef, disabled }: CitySearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Destination[]>([]);
  const [source, setSource] = useState<'live' | 'offline'>('live');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  /** Last thing we announced to screen readers ("Added Kyoto"). */
  const [message, setMessage] = useState('');
  const listId = useId();
  const localInput = useRef<HTMLInputElement | null>(null);
  /** Increments on every search so a slow, older answer can be ignored. */
  const requestId = useRef(0);
  const text = query.trim();

  // Debounced search: wait until typing pauses for 300 ms before asking Photon.
  useEffect(() => {
    if (text.length < 2) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      void searchCities(text).then((r) => {
        if (id !== requestId.current) return; // a newer search has started
        setResults(r.results);
        setSource(r.source);
        setLoading(false);
        setActive(r.results.length ? 0 : -1);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  const exactMatch = results.some((r) => r.name.toLowerCase() === text.toLowerCase());
  const options: CityOption[] = [
    ...results.map((dest) => ({ kind: 'city' as const, dest, added: value.some((v) => sameDest(v, dest)) })),
    ...(text.length >= 2 && !exactMatch && !loading ? [{ kind: 'custom' as const, name: text }] : []),
  ];
  const listOpen = open && text.length >= 2 && !disabled;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const focusInput = () => localInput.current?.focus();

  /** Add the chosen option as a destination. */
  const pick = (opt: CityOption) => {
    if (opt.kind === 'city') {
      if (opt.added) {
        setMessage(`${opt.dest.name} is already on your list`);
        return;
      }
      onChange([...value, opt.dest]);
      setMessage(`Added ${opt.dest.name}`);
    } else {
      // We don't know exactly where a typed-in place is. Borrow the closest
      // search hit's location, or the trip's first stop, so maps and nearby
      // searches still have something sensible to center on.
      const geo = results[0];
      const near = value.find((d) => !isUnmapped(d));
      onChange([
        ...value,
        {
          id: `custom-${Date.now().toString(36)}`,
          name: opt.name,
          country: geo?.country,
          lat: geo?.lat ?? near?.lat ?? 0,
          lng: geo?.lng ?? near?.lng ?? 0,
        },
      ]);
      setMessage(`Added ${opt.name}`);
    }
    setQuery('');
    setResults([]);
    setActive(-1);
    setOpen(false);
  };

  const remove = (index: number) => {
    const removed = value[index];
    onChange(value.filter((_, i) => i !== index));
    setMessage(`Removed ${removed.name}`);
    focusInput(); // the button that had focus is gone
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? Math.min(options.length - 1, i + 1) : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      // Enter picks a result instead of submitting the whole form.
      if (text) e.preventDefault();
      if (listOpen && active >= 0 && options[active]) pick(options[active]);
    } else if (e.key === 'Escape') {
      if (listOpen) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        setQuery('');
      }
    }
  };

  const status = loading ? 'Searching…' : listOpen ? `${results.length} ${results.length === 1 ? 'city' : 'cities'} found. Use the up and down arrows to choose.` : message;

  // <Field> passes `required`; we leave it off the text box because it's empty
  // after each pick (the chips hold the real value), which would trip the browser.
  const { required: _required, ...aria } = control;

  return (
    <div className="p06-cities">
      <div className={`p06-combo ${listOpen ? 'is-open' : ''}`}>
        <Search className="p06-combo-icon" aria-hidden />
        <input
          {...aria}
          ref={(el) => {
            localInput.current = el;
            if (typeof inputRef === 'function') inputRef(el);
            else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
          }}
          className="input p06-combo-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
          aria-required={value.length === 0}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={value.length ? 'Add another city' : 'Search for a city'}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {loading && <Loader2 className="p06-combo-spinner spin" aria-hidden />}

        {listOpen && (
          <div className="p06-combo-pop">
            {loading && results.length === 0 && (
              <p className="p06-combo-status">
                <Loader2 className="spin" aria-hidden /> Searching…
              </p>
            )}
            {!loading && results.length === 0 && <p className="p06-combo-status">No matching cities.</p>}
            <ul id={listId} role="listbox" aria-label="Matching cities" className="p06-combo-list">
              {options.map((opt, i) => (
                <li
                  key={opt.kind === 'city' ? `${opt.dest.id}-${i}` : 'custom'}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={opt.kind === 'city' && opt.added ? true : undefined}
                  className={`p06-combo-option ${i === active ? 'is-active' : ''} ${opt.kind === 'custom' ? 'is-custom' : ''}`}
                  // Keep focus in the text box while clicking an option.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => pick(opt)}
                >
                  {opt.kind === 'city' ? (
                    <>
                      <MapPin className="p06-combo-option-icon" aria-hidden />
                      <span className="p06-combo-option-text">
                        <span className="p06-combo-option-name">{opt.dest.name}</span>
                        {opt.dest.country && <span className="p06-combo-option-sub">{opt.dest.country}</span>}
                      </span>
                      {opt.added && <span className="p06-combo-added">Added</span>}
                    </>
                  ) : (
                    <>
                      <Plus className="p06-combo-option-icon" aria-hidden />
                      <span className="p06-combo-option-text">
                        <span className="p06-combo-option-name">Add “{opt.name}” as a destination</span>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {source === 'offline' && !loading && (
              <p className="p06-combo-offline">
                <WifiOff aria-hidden /> Offline suggestions. Live search isn’t responding right now.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {value.length > 0 && (
        <ol className="p06-chips" aria-label="Your destinations, in order">
          {value.map((d, i) => (
            <li key={d.id} className="p06-chip">
              <span className="p06-chip-num" aria-hidden>
                {i + 1}
              </span>
              <span className="p06-chip-text">
                <span className="p06-chip-name">{d.name}</span>
                {d.country && <span className="p06-chip-sub">{d.country}</span>}
              </span>
              {isUnmapped(d) && (
                <span className="p06-chip-warn" title="We couldn’t find this place on the map">
                  <MapPinOff aria-hidden />
                  <span>Not on map</span>
                </span>
              )}
              <button type="button" className="p06-chip-remove" aria-label={`Remove ${d.name}`} onClick={() => remove(i)} disabled={disabled}>
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
