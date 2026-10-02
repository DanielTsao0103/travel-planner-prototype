/**
 * The trip's shared to-do list: beside the week calendar on the dashboard
 * (Page 10), and filtered to one day on the day page (Page 11).
 *
 * Who can check an item off: anyone who can manage to-dos (Owner, Editors,
 * Day editors) plus the person the item is assigned to. Everyone else sees a
 * lock, and tapping it explains why. Only people who can manage to-dos see the
 * "add" form; Viewers get a short note instead.
 */

import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, Check, ChevronRight, Lock, Plus } from 'lucide-react';
import type { AppState, ISODate, Todo, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { dayNumber, formatMMDD, formatShortDate } from '../../lib/dates';
import { firstName } from '../../lib/format';
import { addTodo, toggleTodo } from '../../store/actions';
import { getPerson, tripDays, tripPeople } from '../../store/selectors';
import { toast } from '../../store/toast';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, LockNote } from '../../components/ui/Display';
import { Segmented, Select } from '../../components/ui/Field';
import { eventLabel } from '../../components/domain/EventItem';
import './p10.css';

export interface TodoListProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  /** Demo-clock date, for "Today" and "overdue" labels. */
  today: ISODate;
  /** Page 11: only this day's to-dos, and new ones default to this day. */
  date?: ISODate;
  /** Phones: show this many open items, then a "Show all (n)" expander. */
  previewCount?: number;
  /** Show the All / Mine filter. */
  showFilter?: boolean;
  title?: string;
  className?: string;
}

/** Undated to-dos go last; otherwise earliest day first (so overdue items lead). */
function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

export function TodoList({ state, trip, access, today, date, previewCount, showFilter = true, title = 'To-do', className = '' }: TodoListProps) {
  const headingId = useId();
  const doneListId = useId();
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [expanded, setExpanded] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const me = access.actingPersonId;

  const all = state.todos.filter((t) => t.tripId === trip.id && (!date || t.date === date));
  const visible = filter === 'mine' ? all.filter((t) => t.assigneeId === me) : all;
  const open = sortTodos(visible.filter((t) => !t.done));
  const done = visible.filter((t) => t.done);
  const collapsed = !!previewCount && !expanded && open.length > previewCount;
  const shownOpen = collapsed ? open.slice(0, previewCount) : open;

  let emptyText: string | null = null;
  if (all.length === 0) emptyText = date ? `Nothing on the to-do list for Day ${dayNumber(trip, date)}.` : 'No to-dos yet.';
  else if (visible.length === 0) emptyText = 'Nothing is assigned to you.';
  else if (open.length === 0) emptyText = 'Everything is checked off.';

  return (
    <section className={`p10-todos ${className}`} aria-labelledby={headingId}>
      <div className="p10-todos-head">
        <div className="p10-todos-title">
          <h2 id={headingId} className="p10-section-title">
            {title}
          </h2>
          <span className="p10-count num">{open.length} open</span>
        </div>
        {showFilter && all.length > 0 && (
          <Segmented
            size="sm"
            label="Which to-dos to show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'mine', label: 'Mine' },
            ]}
          />
        )}
      </div>

      {emptyText && <p className="p10-todos-empty">{emptyText}</p>}

      {shownOpen.length > 0 && (
        <ul className="p10-todo-list">
          {shownOpen.map((t) => (
            <TodoRow key={t.id} todo={t} state={state} trip={trip} access={access} today={today} hideDay={!!date} />
          ))}
        </ul>
      )}

      {!!previewCount && open.length > previewCount && (
        <button type="button" className="p10-text-btn" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer' : `Show all (${open.length})`}
        </button>
      )}

      {done.length > 0 && (
        <div className="p10-todo-done">
          <button type="button" className="p10-done-toggle" aria-expanded={showDone} aria-controls={doneListId} onClick={() => setShowDone((v) => !v)}>
            <ChevronRight className={showDone ? 'is-open' : ''} aria-hidden />
            Done ({done.length})
          </button>
          {showDone && (
            <ul id={doneListId} className="p10-todo-list is-done-list">
              {done.map((t) => (
                <TodoRow key={t.id} todo={t} state={state} trip={trip} access={access} today={today} hideDay={!!date} />
              ))}
            </ul>
          )}
        </div>
      )}

      {access.canManageTodos ? (
        <AddTodoForm state={state} trip={trip} access={access} defaultDate={date} />
      ) : (
        <LockNote>{access.lockReason('manageTodos')}</LockNote>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- one row */

function TodoRow({ todo, state, trip, access, today, hideDay }: { todo: Todo; state: AppState; trip: Trip; access: TripAccess; today: ISODate; hideDay: boolean }) {
  const textId = useId();
  // The rule from the brief: managers can toggle anything; anyone can toggle their own.
  const canToggle = access.canManageTodos || todo.assigneeId === access.actingPersonId;
  const reason = access.lockReason('manageTodos');
  const assignee = todo.assigneeId ? getPerson(state, todo.assigneeId) : undefined;
  const event = todo.eventId ? state.events.find((e) => e.id === todo.eventId) : undefined;
  const isMine = todo.assigneeId === access.actingPersonId;

  const onToggle = () => {
    if (!canToggle) {
      toast({ title: 'You can’t check this off', body: reason, tone: 'info' });
      return;
    }
    toggleTodo(todo.id);
    if (!todo.done) {
      toast({ title: 'Marked done', body: todo.text, tone: 'success', action: { label: 'Undo', onClick: () => toggleTodo(todo.id) } });
    }
  };

  return (
    <li className={`p10-todo ${todo.done ? 'is-done' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-labelledby={textId}
        aria-disabled={canToggle ? undefined : true}
        title={canToggle ? undefined : reason}
        className={`p10-check ${canToggle ? '' : 'is-locked'}`}
        onClick={onToggle}
      >
        <span className="p10-check-box" aria-hidden>
          {todo.done ? <Check /> : canToggle ? null : <Lock />}
        </span>
      </button>
      <div className="p10-todo-body">
        <span id={textId} className="p10-todo-text">
          {todo.text}
        </span>
        <span className="p10-todo-meta">
          {!hideDay && <DayTag trip={trip} date={todo.date} today={today} done={todo.done} />}
          {event && (
            <Link to={withQuery(paths.day(trip.id, event.date), { focus: event.id })} className="p10-todo-event">
              {eventLabel(event)}
            </Link>
          )}
          {!assignee && <span>Unassigned</span>}
          {assignee && <span className="p10-todo-who">{isMine ? 'You' : firstName(assignee.name)}</span>}
        </span>
      </div>
      {assignee && <Avatar person={assignee} size={26} />}
    </li>
  );
}

/** "Day 3", "Today · Day 2", or "Day 1 · overdue". */
function DayTag({ trip, date, today, done }: { trip: Trip; date?: ISODate; today: ISODate; done: boolean }) {
  if (!date) return null;
  const inTrip = date >= trip.startDate && date <= trip.endDate;
  const label = inTrip ? `Day ${dayNumber(trip, date)}` : formatShortDate(date);
  if (date === today && !done) return <Badge tone="accent">Today</Badge>;
  if (!done && date < today) return <span className="p10-todo-late">{label} · overdue</span>;
  return <span>{label}</span>;
}

/* ------------------------------------------------------------- add form */

function AddTodoForm({ state, trip, access, defaultDate }: { state: AppState; trip: Trip; access: TripAccess; defaultDate?: ISODate }) {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState('');
  const [day, setDay] = useState<string>(defaultDate ?? '');
  const [who, setWho] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const people = tripPeople(state, trip).filter((p) => p.status === 'accepted');
  const days = tripDays(trip);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) {
      setError('Write what needs doing first.');
      return;
    }
    addTodo({ tripId: trip.id, text: clean, date: day || undefined, assigneeId: who || undefined });
    setText('');
    setError(null);
    // e.g. “Buy metro cards” for Priya on Day 4.
    const forWho = who ? ` for ${who === access.actingPersonId ? 'you' : firstName(getPerson(state, who)?.name ?? '')}` : '';
    const onDay = day ? ` on Day ${dayNumber(trip, day)}` : '';
    toast({ title: 'To-do added', body: `“${clean}”${forWho}${onDay}.`, tone: 'success' });
  };

  return (
    <form className="p10-todo-add" onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="sr-only">
        New to-do
      </label>
      <div className="p10-todo-add-main">
        <input
          id={inputId}
          className="input"
          placeholder="Add a to-do"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
        />
        <Button type="submit" icon={<Plus />} className="p10-todo-add-btn">
          Add
        </Button>
      </div>
      <div className="p10-todo-add-row">
        <Select aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">No day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              Day {dayNumber(trip, d)} · {formatMMDD(d)}
            </option>
          ))}
        </Select>
        <Select aria-label="Assign to" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Unassigned</option>
          {people.map(({ person }) => (
            <option key={person.id} value={person.id}>
              {person.id === access.actingPersonId ? 'You' : firstName(person.name)}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          <AlertCircle aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </form>
  );
}
