/**
 * Prototype controls — tools for testing, NOT part of the app's design:
 *  - demo clock (before / during / after a trip) to show the active-trip dashboard
 *  - "View as" role switch (Owner / Editor / Day editor / Viewer)
 *  - simulations: nearby suggestion, bank alert, Gmail receipt match, failed connection
 *  - slow mode (loading states), show/hide the sample trip, reset everything
 */

import { useEffect, useState } from 'react';
import { BellRing, Clock, FlaskConical, ListChecks, Mail, MapPin, RotateCcw, Timer, Users } from 'lucide-react';
import type { Role } from '../../data/types';
import { triggerNearby } from '../../features/nearby';
import { addDays, formatShortDate, formatTime, realTodayISO, resolveClock } from '../../lib/dates';
import { pushDemoNotification, resetDemoData, setClock, setDemo } from '../../store/actions';
import { activeTrip, currentPerson, currentTrip, getTrip, jumpTarget, myTrips } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Display';
import { Field, Segmented, Select, Switch, TextInput } from '../ui/Field';
import { Sheet } from '../ui/Overlay';

export function PrototypeDrawer({ open, onClose, contextTripId }: { open: boolean; onClose: () => void; contextTripId?: string }) {
  const state = useAppState();
  const me = currentPerson(state);
  const trips = myTrips(state);
  const defaultTrip = getTrip(state, contextTripId) ?? currentTrip(state) ?? trips[0];
  const [tripId, setTripId] = useState(defaultTrip?.id ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const clock = resolveClock(state.demo.clock);
  const [customDate, setCustomDate] = useState(clock.date);
  const [customTime, setCustomTime] = useState(clock.time);

  useEffect(() => {
    if (open) {
      setTripId((getTrip(state, contextTripId) ?? currentTrip(state) ?? trips[0])?.id ?? '');
      setCustomDate(clock.date);
      setCustomTime(clock.time);
      setConfirmReset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trip = getTrip(state, tripId);
  const viewAs = state.demo.viewAs ?? 'me';

  const jumpInto = () => {
    if (!trip) return;
    setClock(jumpTarget(trip));
    onClose();
    navigate(paths.dashboard(trip.id));
    toast({ title: 'Demo clock moved into the trip', body: `It’s now ${formatShortDate(jumpTarget(trip).date)}, ${formatTime(jumpTarget(trip).time)}.`, tone: 'info' });
  };

  const setBefore = () => {
    if (!trip) return;
    setClock({ date: addDays(trip.startDate, -14), time: '10:00' });
    toast({ title: 'Demo clock set before the trip', tone: 'info' });
  };

  const setAfter = () => {
    if (!trip) return;
    setClock({ date: addDays(trip.endDate, 4), time: '10:00' });
    toast({ title: 'Demo clock set after the trip', tone: 'info' });
  };

  const nearby = async () => {
    const t = activeTrip(state);
    if (!t) {
      toast({ title: 'Jump into a trip first', body: 'Nearby suggestions only appear while you’re on a trip.', tone: 'info' });
      return;
    }
    onClose();
    const result = await triggerNearby(t.id, { force: true });
    if (result === 'none') toast({ title: 'Nothing matched nearby', body: 'No place within about 500 ft matched the group’s preferences.', tone: 'info' });
    if (result === 'error') toast({ title: 'Couldn’t check nearby places', body: 'The map data service didn’t respond. Try again in a moment.', tone: 'warning' });
  };

  const bankAlert = () => {
    const t = activeTrip(state) ?? trip;
    if (!t) return;
    pushDemoNotification({ kind: 'bank', tripId: t.id, amount: 23.4, merchant: 'Manteigaria Café', category: 'food', date: resolveClock(state.demo.clock).date });
    onClose();
    navigate(paths.budget(t.id));
    toast({ title: 'Simulated bank alert received', body: '$23.40 at Manteigaria Café — review it in Budget.', tone: 'info' });
  };

  const gmailMatch = () => {
    const t = activeTrip(state) ?? trip;
    if (!t) return;
    pushDemoNotification({ kind: 'gmail', tripId: t.id, amount: 64, merchant: 'Sintra Palace Pass (email receipt)', category: 'activities', date: resolveClock(state.demo.clock).date });
    onClose();
    navigate(paths.budget(t.id));
    toast({ title: 'Simulated Gmail receipt found', body: 'Review the match in Budget.', tone: 'info' });
  };

  const roleOptions: Array<{ value: Role | 'me'; label: string }> = [
    { value: 'me', label: 'Me' },
    { value: 'editor', label: 'Editor' },
    { value: 'day', label: 'Day editor' },
    { value: 'viewer', label: 'Viewer' },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Prototype controls" description="Testing tools. These aren’t part of the app’s design." variant="side" size="md">
      <div className="stack-lg proto-drawer">
        <section className="stack-md" aria-labelledby="proto-clock">
          <h3 id="proto-clock" className="h4 row">
            <Clock aria-hidden width={18} /> Demo clock
          </h3>
          <p className="small muted">
            Now: <strong className="num">{formatShortDate(clock.date)}, {formatTime(clock.time)}</strong> {state.demo.clock ? '(simulated)' : '(real time)'}
          </p>
          {trips.length > 0 && (
            <Field label="Trip">
              {(p) => (
                <Select {...p} value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <div className="cluster">
            <Button size="sm" variant="primary" icon={<Timer />} onClick={jumpInto} disabled={!trip}>
              Jump into trip
            </Button>
            <Button size="sm" variant="secondary" onClick={setBefore} disabled={!trip}>
              Before trip
            </Button>
            <Button size="sm" variant="secondary" onClick={setAfter} disabled={!trip}>
              After trip
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setClock(null); toast({ title: 'Using the real date and time', tone: 'info' }); }}>
              Use real time
            </Button>
          </div>
          <div className="proto-custom">
            <Field label="Date">{(p) => <TextInput {...p} type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}</Field>
            <Field label="Time">{(p) => <TextInput {...p} type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />}</Field>
            <Button size="sm" variant="secondary" onClick={() => customDate && customTime && setClock({ date: customDate, time: customTime })}>
              Set
            </Button>
          </div>
        </section>

        <section className="stack-md" aria-labelledby="proto-role">
          <h3 id="proto-role" className="h4 row">
            <Users aria-hidden width={18} /> View as
          </h3>
          <Segmented label="View as" options={roleOptions} value={viewAs} onChange={(v) => setDemo({ viewAs: v === 'me' ? null : (v as Role) })} size="sm" />
          <p className="small muted">On the sample trip this switches to a companion: Editor = Jordan, Day editor = Sam (Day 3), Viewer = Priya. On your own trips it changes only your role.</p>
        </section>

        <section className="stack-md" aria-labelledby="proto-sim">
          <h3 id="proto-sim" className="h4 row">
            <FlaskConical aria-hidden width={18} /> Simulate
          </h3>
          <div className="cluster">
            <Button size="sm" variant="secondary" icon={<MapPin />} onClick={nearby}>
              Nearby suggestion
            </Button>
            <Button size="sm" variant="secondary" icon={<BellRing />} onClick={bankAlert}>
              Bank alert
            </Button>
            <Button size="sm" variant="secondary" icon={<Mail />} onClick={gmailMatch}>
              Gmail receipt
            </Button>
          </div>
          <Switch label="Fail the next account connection" description="Page 3 will show its error state once." checked={state.demo.failNextConnect} onChange={(v) => setDemo({ failNextConnect: v })} />
          <Switch label="Slow mode" description="Lengthens simulated loading so loading states are easy to see." checked={state.demo.slowMode} onChange={(v) => setDemo({ slowMode: v })} />
          <Switch label="Show the sample trip" description="Hide it to see empty states." checked={state.demo.showSample} onChange={(v) => setDemo({ showSample: v })} />
        </section>

        <section className="stack-sm">
          <Button variant="ghost" icon={<ListChecks />} onClick={() => { onClose(); navigate(paths.protoIndex()); }}>
            Screen index & requirement checklist
          </Button>
        </section>

        <section className="stack-md">
          {confirmReset ? (
            <Banner
              tone="warning"
              title="Reset all prototype data?"
              action={
                <div className="cluster">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      resetDemoData();
                      onClose();
                      navigate(paths.login());
                      toast({ title: 'Prototype reset', body: 'All trips and changes were restored to the original sample data.', tone: 'info' });
                    }}
                  >
                    Reset
                  </Button>
                </div>
              }
            >
              Trips you created and every change are removed, and you’ll be logged out.
            </Banner>
          ) : (
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
              Reset prototype data
            </Button>
          )}
          {me && <p className="xsmall muted">Signed in as {me.name}. Data seeded {formatShortDate(state.seededOn)} · real date {formatShortDate(realTodayISO())}.</p>}
        </section>
      </div>
    </Sheet>
  );
}
