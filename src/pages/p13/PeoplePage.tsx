/**
 * Page 13 — Group & permissions.
 *
 * Three parts, all visible to everyone on the trip:
 *   1. Food & dining tiles              ← combined from everyone's survey (Page 15)
 *   2. Travel preferences & limitations ← survey answers + the planned stops
 *   3. Collaborators                    ← roles and invites; only the Owner can change them
 *
 * Layout: desktop = tiles (2-column grid) + a sticky collaborators rail.
 * Phones/tablets = a sticky "Food · Travel · People" section nav over one
 * stacked column; role changes open as bottom sheets.
 *
 * Query params (forced states for the screen index):
 *   section=food|travel|collaborators  scroll to that part of the page
 *   s=role     13D change role (opens for Sam)
 *   s=invite   13E invite someone
 *   s=remove   13F remove someone (opens for Priya)
 *   s=saved    15G just saved the survey: success banner + your answers highlighted
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, Send, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react';
import type { Person } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { listJoin } from '../../lib/format';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { currentPerson, getPerson, personFirstName, tripEvents } from '../../store/selectors';
import { toast } from '../../store/toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { AvatarStack, Banner, EmptyState } from '../../components/ui/Display';
import { groupPicture, type GroupPicture, type Member } from './aggregate';
import { Collaborators } from './Collaborators';
import { FoodTiles } from './FoodTiles';
import { InviteSheet, RemoveSheet, RoleSheet } from './Sheets';
import { joinNames, PeopleProvider, type PeopleLookup } from './TileParts';
import { TravelTiles } from './TravelTiles';
import './p13.css';

type SheetState = { kind: 'role' | 'remove'; personId: string } | { kind: 'invite' } | null;

const SECTIONS = [
  { id: 'p13-food', label: 'Food' },
  { id: 'p13-travel', label: 'Travel' },
  { id: 'p13-people', label: 'People' },
] as const;
const SECTION_IDS = SECTIONS.map((s) => s.id);

/** Map `?section=` to an element id on the page. */
function sectionTarget(section: string | null): string | null {
  if (section === 'food') return 'p13-food';
  if (section === 'travel') return 'p13-travel';
  if (section === 'collaborators' || section === 'people') return 'p13-people';
  return null;
}

/** True when the person asked their device for less motion (we then jump instead of smooth-scrolling). */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Page 13 entry point: loads the trip, or explains that it isn’t available. */
export function PeoplePage({ tripId, query }: { tripId: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  if (!ctx) {
    return (
      <div className="container page">
        <PageHeader title="Group & permissions" back={{ to: paths.trips(), label: 'My trips' }} />
        <EmptyState icon={<Users />} title="This trip isn’t available" actions={<Button to={paths.trips()}>Go to My trips</Button>}>
          It may have been deleted, or you’re no longer on it.
        </EmptyState>
      </div>
    );
  }
  return <PeopleView ctx={ctx} query={query} />;
}

/** The page itself, once we know the trip exists and the person is on it. */
function PeopleView({ ctx, query }: { ctx: TripContext; query: URLSearchParams }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const me = currentPerson(state);
  const picture = groupPicture(state, trip);
  const events = tripEvents(state, trip.id);
  const s = query.get('s');
  const section = query.get('section');
  const saved = s === 'saved';
  const canManage = access.canManagePeople;

  const [sheet, setSheet] = useState<SheetState>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashPanel, setFlashPanel] = useState(false);

  /** A demo person for the forced states: the preferred id if they're on the trip, else someone with that role. */
  const demoPerson = (preferredId: string, role: Member['role']): string | null => {
    const others = picture.members.filter((m) => m.role !== 'owner');
    return (others.find((m) => m.person.id === preferredId) ?? others.find((m) => m.role === role) ?? others[0])?.person.id ?? null;
  };

  // Forced states from the URL (?s=role / invite / remove). Only the Owner can open them.
  useEffect(() => {
    if (!canManage) return;
    if (s === 'invite') setSheet({ kind: 'invite' });
    if (s === 'role' || s === 'remove') {
      const personId = s === 'role' ? demoPerson('p-sam', 'day') : demoPerson('p-priya', 'viewer');
      if (personId) setSheet({ kind: s, personId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, canManage]);

  // ?section= scrolls to that part of the page (after layout settles).
  useEffect(() => {
    const target = sectionTarget(section);
    if (!target) return;
    const t = window.setTimeout(() => {
      if (target === 'p13-people' && isDesktop) {
        // On desktop the collaborators rail is already on screen: point at it instead of scrolling.
        setFlashPanel(true);
        document.getElementById('p13-people-title')?.focus({ preventScroll: true });
        window.setTimeout(() => setFlashPanel(false), 1800);
        return;
      }
      document.getElementById(target)?.scrollIntoView({ block: 'start' });
    }, 160);
    return () => window.clearTimeout(t);
  }, [section, isDesktop]);

  // Clear a row highlight a moment after it appears.
  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 2400);
    return () => window.clearTimeout(t);
  }, [flashId]);

  /** Drop `?s=` from the address (so a reload doesn't reopen a sheet), keeping `section`. */
  const clearForcedState = () => {
    if (s) navigate(withQuery(paths.people(trip.id), { section }), { replace: true });
  };

  const closeSheet = () => {
    setSheet(null);
    if (s === 'role' || s === 'invite' || s === 'remove') clearForcedState();
  };

  const surveyHref = withQuery(paths.survey(), { trip: trip.id, return: paths.people(trip.id) });
  const myHasSurvey = !!(me && state.surveys[me.id]);

  // Tiles turn ids into names: "You" for the acting person, first names for everyone else.
  const lookup: PeopleLookup = useMemo(
    () => ({
      person: (id: string) => getPerson(state, id),
      name: (id: string) => (id === access.actingPersonId ? 'You' : personFirstName(state, id)),
      // After saving the survey (15G), highlight the signed-in person's answers: it's their survey.
      highlightId: saved ? (me?.id ?? access.actingPersonId) : null,
      total: picture.responders.length,
    }),
    [state, access.actingPersonId, saved, me?.id, picture.responders.length],
  );

  const sheetMember = sheet && sheet.kind !== 'invite' ? (picture.members.find((m) => m.person.id === sheet.personId) ?? null) : null;

  const header = (
    <PageHeader
      title="Group & permissions"
      subtitle="Everyone’s survey answers, combined, so meals and stops work for the whole group."
      actions={
        <>
          <Button variant={canManage ? 'secondary' : 'primary'} icon={<SlidersHorizontal />} to={surveyHref}>
            {myHasSurvey ? 'Update my preferences' : 'Add my preferences'}
          </Button>
          {canManage && (
            <Button icon={<UserPlus />} onClick={() => setSheet({ kind: 'invite' })}>
              Invite people
            </Button>
          )}
        </>
      }
    />
  );

  const savedBanner = saved && (
    <Banner
      tone="success"
      className="p13-saved"
      title="Your preferences were saved."
      action={
        <div className="p13-saved-actions">
          <Button size="sm" variant="secondary" to={surveyHref}>
            Edit answers
          </Button>
          <IconButton label="Dismiss" icon={<X />} size="sm" onClick={clearForcedState} />
        </div>
      }
    >
      Here’s how they add up with the group. Your answers are highlighted.
    </Banner>
  );

  const noAnswers = picture.responders.length === 0;
  const tiles = (
    <>
      <PageSection id="p13-food" title="Food & dining" description="For picking restaurants. Combined from everyone’s survey.">
        {noAnswers ? <NoAnswers myHasSurvey={myHasSurvey} surveyHref={surveyHref} /> : <FoodTiles responders={picture.responders} events={events} trip={trip} />}
      </PageSection>
      <PageSection id="p13-travel" title="Travel preferences & limitations" description="For choosing stops and pacing each day. Checked against the planned itinerary.">
        {noAnswers ? <NoAnswers myHasSurvey={myHasSurvey} surveyHref={surveyHref} /> : <TravelTiles responders={picture.responders} events={events} trip={trip} />}
      </PageSection>
    </>
  );

  const collaborators = (
    <Collaborators
      trip={trip}
      access={access}
      members={picture.members}
      surveys={state.surveys}
      flashId={flashId}
      flashPanel={flashPanel}
      rail={isDesktop}
      onInvite={() => setSheet({ kind: 'invite' })}
      onChangeRole={(personId) => setSheet({ kind: 'role', personId })}
      onRemove={(personId) => setSheet({ kind: 'remove', personId })}
    />
  );

  return (
    <PeopleProvider value={lookup}>
      <div className="container page p13-page">
        {header}
        <div className="p13-top">
          {savedBanner}
          <ResponseStatus picture={picture} meId={me?.id} actingId={access.actingPersonId} canManage={canManage} surveyHref={surveyHref} />
        </div>

        {isDesktop ? (
          <div className="p13-layout">
            <div className="p13-main">{tiles}</div>
            <aside className="p13-rail" aria-label="Collaborators">
              {collaborators}
            </aside>
          </div>
        ) : (
          <>
            <SectionNav />
            <div className="p13-main">
              {tiles}
              {collaborators}
            </div>
          </>
        )}
      </div>

      <RoleSheet
        open={sheet?.kind === 'role'}
        trip={trip}
        member={sheet?.kind === 'role' ? sheetMember : null}
        onClose={closeSheet}
        onSaved={(personId) => {
          closeSheet();
          setFlashId(personId);
        }}
      />
      <RemoveSheet open={sheet?.kind === 'remove'} trip={trip} member={sheet?.kind === 'remove' ? sheetMember : null} onClose={closeSheet} onRemoved={closeSheet} />
      <InviteSheet
        open={sheet?.kind === 'invite'}
        trip={trip}
        onClose={closeSheet}
        onInvited={(personId) => {
          closeSheet();
          setFlashId(personId);
          if (!isDesktop) window.setTimeout(() => document.getElementById('p13-people')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }), 80);
        }}
      />
    </PeopleProvider>
  );
}

/* ------------------------------------------------------------ sections */

function PageSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="p13-section" aria-labelledby={`${id}-title`}>
      <div className="p13-section-head">
        <h2 id={`${id}-title`} className="p13-section-title">
          {title}
        </h2>
        <p className="p13-section-desc">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Shown in place of the tiles when nobody on the trip has answered yet. */
function NoAnswers({ myHasSurvey, surveyHref }: { myHasSurvey: boolean; surveyHref: string }) {
  return (
    <EmptyState compact icon={<SlidersHorizontal />} title="No preferences shared yet" actions={!myHasSurvey ? <Button to={surveyHref}>Add my preferences</Button> : undefined}>
      When people fill in the 2-minute survey, their answers add up here.
    </EmptyState>
  );
}

/* ------------------------------------------------------ response status */

/**
 * "5 of 5 travelers shared preferences · Diego Alvarez hasn't accepted the invite yet",
 * plus a nudge for anyone who joined but hasn't answered.
 */
function ResponseStatus({ picture, meId, actingId, canManage, surveyHref }: { picture: GroupPicture; meId?: string; actingId: string; canManage: boolean; surveyHref: string }) {
  const { responders, accepted, missing, pending } = picture;
  const meMissing = missing.some((p) => p.id === meId);
  const othersMissing = missing.filter((p) => p.id !== meId);
  const fullName = (p: Person) => (p.id === actingId ? 'You' : p.name);
  const pendingNames = pending.map(fullName);

  return (
    <div className="p13-status-wrap">
      {meMissing && (
        <Banner
          tone="info"
          title="Add your preferences"
          action={
            <Button size="sm" to={surveyHref}>
              Add my preferences
            </Button>
          }
        >
          The tiles below don’t include you yet. It takes about 2 minutes.
        </Banner>
      )}
      <div className="p13-status">
        {responders.length > 0 && <AvatarStack people={responders.map((r) => r.person)} size={28} max={6} />}
        <p className="p13-status-text">
          <strong className="num">
            {responders.length} of {accepted.length} travelers
          </strong>{' '}
          shared preferences
          {pendingNames.length > 0 && (
            <>
              <span className="p13-status-sep" aria-hidden>
                {' '}
                ·{' '}
              </span>
              <span className="p13-status-pending">
                {joinNames(pendingNames, { start: true })} {pendingNames.length === 1 ? 'hasn’t' : 'haven’t'} accepted the invite yet
              </span>
            </>
          )}
        </p>
        {canManage && pending.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Send />}
            className="p13-status-btn"
            onClick={() => toast({ title: 'Reminder simulated', body: `No email was sent. In the real app, ${listJoin(pending.map((p) => p.name))} would get a fresh invite.`, tone: 'info' })}
          >
            Resend invite
          </Button>
        )}
      </div>
      {othersMissing.length > 0 && (
        <p className="p13-status-nudge">
          Waiting on {joinNames(othersMissing.map(fullName))} to share preferences.{' '}
          <button
            type="button"
            className="p13-linkbtn"
            onClick={() => toast({ title: 'Reminder simulated', body: `No message was sent. ${listJoin(othersMissing.map((p) => p.name))} would get a nudge to fill in the survey.`, tone: 'info' })}
          >
            Send a reminder
          </button>
        </p>
      )}
      <p className="p13-privacy">
        <Eye aria-hidden />
        Survey answers are visible to everyone on this trip.
      </p>
    </div>
  );
}

/* --------------------------------------------------- phone section nav */

/** Which section the reader is in, based on scroll position (for the sticky nav). */
function useActiveSection(offset: number): string {
  const [active, setActive] = useState<string>(SECTION_IDS[0]);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      let current: string = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - offset <= 1) current = id;
      }
      // At the very bottom the last section counts as active, even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTION_IDS[SECTION_IDS.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [offset]);
  return active;
}

/** Sticky "Food · Travel · People" jump links for phones and tablets. */
function SectionNav() {
  // Header (64px) + this nav (~68px): a section counts as "current" once its top passes under them.
  const active = useActiveSection(140);
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  return (
    <nav className="p13-secnav" aria-label="Page sections">
      <div className="p13-secnav-inner">
        {SECTIONS.map((sec) => (
          <button key={sec.id} type="button" className={active === sec.id ? 'is-active' : ''} aria-current={active === sec.id ? 'location' : undefined} onClick={() => jump(sec.id)}>
            {sec.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
