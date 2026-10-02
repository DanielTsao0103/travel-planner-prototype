/**
 * Shown when a trip-specific menu item (Budget, Calendar, Collaborators) is
 * opened but the person has no trip yet (plan §2 "current trip" rule).
 */

import { CalendarDays, PiggyBank, Plus, Users } from 'lucide-react';
import { paths } from '../../router/routes';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Display';
import { PageHeader } from './PageHeader';

const COPY = {
  calendar: { title: 'Calendar', icon: <CalendarDays />, body: 'The calendar shows a day-by-day breakdown of a trip.' },
  'budget-current': { title: 'Budget', icon: <PiggyBank />, body: 'Budgets and shared expenses live inside a trip.' },
  'people-current': { title: 'Collaborators', icon: <Users />, body: 'Collaborators, permissions, and group preferences live inside a trip.' },
} as const;

export function NoTripPage({ kind }: { kind: keyof typeof COPY | string }) {
  const copy = COPY[kind as keyof typeof COPY] ?? COPY.calendar;
  return (
    <div className="container page">
      <PageHeader title={copy.title} back={{ to: paths.home(), label: 'Home' }} />
      <EmptyState
        icon={copy.icon}
        title="Pick a trip first"
        actions={
          <>
            <Button to={paths.newTrip()} icon={<Plus />}>
              New trip
            </Button>
            <Button to={paths.trips()} variant="secondary">
              Open existing trip
            </Button>
          </>
        }
      >
        {copy.body} You don’t have a trip yet, so create one or open a trip you’ve been invited to.
      </EmptyState>
    </div>
  );
}
