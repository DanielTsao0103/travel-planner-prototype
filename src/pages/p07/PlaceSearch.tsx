/**
 * "Where" search for Page 7: finds places near the trip's destinations.
 *
 * Results come from the bundled catalog (so the sample trip works offline)
 * plus Photon / OpenStreetMap for any city a tester picked. The last option
 * always lets you use exactly what you typed ("Grandma’s house").
 *
 * Keyboard: ↓ / ↑ move through results · Enter picks · Escape closes.
 * The highlighted option is announced with `aria-activedescendant`.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Loader2, Plus, Search, WifiOff } from 'lucide-react';
import type { Place } from '../../data/types';
import type { FieldControlProps } from '../../components/ui/Field';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import type { LatLng } from '../../lib/geo';
import { customPlace, searchPlaces } from '../../services/places';

type PlaceOption = { kind: 'place'; place: Place } | { kind: 'custom'; name: string };

export interface PlaceSearchProps {
  /** Trip destinations to search around (first one is the "home base"). */
  near: LatLng[];
  /** City name used for typed-in places, e.g. "Lisbon". */
  cityLabel: string;
  /** id / aria props from <Field>. */
  control: FieldControlProps;
  onPick: (place: Place) => void;
  /** Text to start with (after "Change", it's the previous place's name). */
  initialQuery?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/** "Belém · Lisbon" without repeating the same word twice. */
export function placeAreaLine(place: Pick<Place, 'area' | 'city'>): string {
  const parts = [place.area, place.city].filter((p, i, all) => p && all.indexOf(p) === i);
  return parts.join(' · ');
}

/** The "Where" combobox (see the file comment). */
export function PlaceSearch({ near, cityLabel, control, onPick, initialQuery = '', autoFocus, inputRef, disabled }: PlaceSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [source, setSource] = useState<'live' | 'offline'>('live');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const requestId = useRef(0);
  const localInput = useRef<HTMLInputElement | null>(null);
  const text = query.trim();
  // A stable string version of `near`, so the search effect doesn't re-run every render.
  const nearKey = near.map((n) => `${n.lat.toFixed(3)},${n.lng.toFixed(3)}`).join('|');

  useEffect(() => {
    if (autoFocus) localInput.current?.focus();
  }, [autoFocus]);

  // Debounced search: wait for a 300 ms pause in typing.
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
      void searchPlaces(text, near).then((r) => {
        if (id !== requestId.current) return; // a newer search started meanwhile
        setResults(r.results);
        setSource(r.source);
        setLoading(false);
        setActive(r.results.length ? 0 : -1);
      });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, nearKey]);

  const exact = results.some((p) => p.name.toLowerCase() === text.toLowerCase());
  const options: PlaceOption[] = [
    ...results.map((place) => ({ kind: 'place' as const, place })),
    ...(text.length >= 2 && !exact && !loading ? [{ kind: 'custom' as const, name: text }] : []),
  ];
  const listOpen = open && text.length >= 2 && !disabled;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const pick = (opt: PlaceOption) => {
    // A typed-in place sits at the trip's first destination (we don't know exactly where it is).
    onPick(opt.kind === 'place' ? opt.place : customPlace(opt.name, near[0], cityLabel));
    setOpen(false);
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
      if (text) e.preventDefault(); // pick, don't submit the form
      if (listOpen && active >= 0 && options[active]) pick(options[active]);
    } else if (e.key === 'Escape' && listOpen) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const status = loading ? 'Searching…' : listOpen ? `${results.length} ${results.length === 1 ? 'place' : 'places'} found. Use the up and down arrows to choose.` : '';
  const { required: _required, ...aria } = control;

  return (
    <div className={`p07-combo ${listOpen ? 'is-open' : ''}`}>
      <Search className="p07-combo-icon" aria-hidden />
      <input
        {...aria}
        ref={(el) => {
          localInput.current = el;
          if (typeof inputRef === 'function') inputRef(el);
          else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
        }}
        className="input p07-combo-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
        aria-required
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="search"
        placeholder={cityLabel ? `Search places in ${cityLabel}` : 'Search for a place'}
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
      {loading && <Loader2 className="p07-combo-spinner spin" aria-hidden />}

      {listOpen && (
        <div className="p07-combo-pop">
          {loading && results.length === 0 && (
            <p className="p07-combo-status">
              <Loader2 className="spin" aria-hidden /> Searching places…
            </p>
          )}
          {!loading && results.length === 0 && <p className="p07-combo-status">No matches nearby.</p>}
          <ul id={listId} role="listbox" aria-label="Matching places" className="p07-combo-list">
            {options.map((opt, i) => (
              <li
                key={opt.kind === 'place' ? `${opt.place.id}-${i}` : 'custom'}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={`p07-combo-option ${i === active ? 'is-active' : ''} ${opt.kind === 'custom' ? 'is-custom' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(opt)}
              >
                {opt.kind === 'place' ? (
                  <>
                    <PlacePhoto photo={opt.place.photo} alt="" category={opt.place.category} className="p07-combo-thumb" />
                    <span className="p07-combo-text">
                      <span className="p07-combo-name">{opt.place.name}</span>
                      <span className="p07-combo-sub">{placeAreaLine(opt.place) || 'Nearby'}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="p07-combo-thumb p07-combo-plus" aria-hidden>
                      <Plus />
                    </span>
                    <span className="p07-combo-text">
                      <span className="p07-combo-name">Use “{opt.name}”</span>
                      <span className="p07-combo-sub">Add it by name{cityLabel ? ` in ${cityLabel}` : ''}</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {source === 'offline' && !loading && (
            <p className="p07-combo-offline">
              <WifiOff aria-hidden /> Live search isn’t responding. Showing saved places only.
            </p>
          )}
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
