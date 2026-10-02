/**
 * "How this shows up for your group" — a live, one-person version of the
 * Page 13 tiles. As someone answers, they see exactly how their answers will
 * read to the rest of the group (with their name attached).
 */

import type { ReactNode } from 'react';
import { Accessibility, Landmark, UtensilsCrossed, Wine } from 'lucide-react';
import type { Person } from '../../data/types';
import { firstName } from '../../lib/format';
import { Avatar, Badge } from '../../components/ui/Display';
import type { SurveyDraft } from './draft';
import {
  ATMOSPHERE_LABEL,
  dietEntriesFor,
  FANCY_SCALE,
  INTEREST_LABEL,
  LOCAL_SCALE,
  MOBILITY_PHRASE,
  normalizeInterests,
  spendOption,
  TICKET_PHRASE,
  walkLabel,
  type ScaleDef,
  type StepNumber,
} from './vocab';

const KIND_TONE = { severe: 'danger', diet: 'neutral', mild: 'warning' } as const;

/** One small tile. `active` marks the tile for the step being answered right now. */
function MiniTile({ icon, title, active, person, children }: { icon: ReactNode; title: string; active?: boolean; person: Person; children: ReactNode }) {
  return (
    <section className={`p15-mini ${active ? 'is-active' : ''}`} aria-label={title}>
      <header className="p15-mini-head">
        <span className="p15-mini-icon" aria-hidden>
          {icon}
        </span>
        <h4 className="p15-mini-title">{title}</h4>
        <span className="p15-mini-who" title={`Shown as ${person.name}`}>
          <Avatar person={person} size={20} />
          <span className="truncate">{firstName(person.name)}</span>
        </span>
      </header>
      <div className="p15-mini-body">{children}</div>
    </section>
  );
}

/** A tiny 5-dot scale with the person's dot filled in. */
function MiniScale({ scale, value }: { scale: ScaleDef; value: number }) {
  return (
    <div className="p15-mini-scale">
      <div className="p15-mini-scale-row" aria-hidden>
        <span className="p15-mini-scale-end">{scale.leftLabel}</span>
        <span className="p15-mini-dots">
          {scale.order.map((v) => (
            <i key={v} className={v === value ? 'is-on' : ''} />
          ))}
        </span>
        <span className="p15-mini-scale-end">{scale.rightLabel}</span>
      </div>
      <p className="p15-mini-value">
        <span className="sr-only">
          {scale.leftLabel} to {scale.rightLabel}:{' '}
        </span>
        {scale.labels[value as keyof ScaleDef['labels']]}
      </p>
    </div>
  );
}

/** Missing required answer, shown in the preview instead of a made-up value. */
function NotYet() {
  return <span className="p15-mini-missing">Not answered yet</span>;
}

/** Four mini tiles (food, dining, interests, getting around) showing one person’s answers. */
export function GroupPreview({ draft, person, activeStep }: { draft: SurveyDraft; person: Person; activeStep?: StepNumber }) {
  const food = draft.noRestrictions ? [] : dietEntriesFor(draft);
  const interests = normalizeInterests(draft.interests);
  const spend = spendOption(draft.mealBudget);
  const needsStepFree = draft.stepFreeNeeded;

  return (
    <div className="p15-preview">
      <MiniTile icon={<UtensilsCrossed />} title="Dietary needs & allergies" active={activeStep === 1} person={person}>
        {food.length > 0 ? (
          <ul className="p15-mini-list">
            {food.map((e) => (
              <li key={e.key}>
                <span className="p15-mini-label">{e.label}</span>
                <Badge tone={KIND_TONE[e.kind]}>{e.badge}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className={draft.noRestrictions ? 'p15-mini-text' : 'p15-mini-empty'}>{draft.noRestrictions ? 'No restrictions' : 'Nothing picked yet'}</p>
        )}
        {draft.dietNotes.trim() && <p className="p15-mini-note">“{draft.dietNotes.trim()}”</p>}
      </MiniTile>

      <MiniTile icon={<Wine />} title="Dining style" active={activeStep === 2} person={person}>
        <MiniScale scale={LOCAL_SCALE} value={draft.localVsFamiliar} />
        <MiniScale scale={FANCY_SCALE} value={draft.simpleVsExtravagant} />
        <p className="p15-mini-text">
          <strong className="num">{spend.symbol}</strong> <span className="muted">· {spend.range} per meal</span>
        </p>
        {draft.atmosphere.length > 0 && (
          <div className="p15-mini-chips">
            {draft.atmosphere.map((a) => (
              <span key={a} className="p15-mini-chip">
                {ATMOSPHERE_LABEL[a]}
              </span>
            ))}
          </div>
        )}
      </MiniTile>

      <MiniTile icon={<Landmark />} title="Interests" active={activeStep === 3} person={person}>
        {interests.length > 0 ? (
          <div className="p15-mini-chips">
            {interests.map((i) => (
              <span key={i} className="p15-mini-chip">
                {INTEREST_LABEL[i]}
              </span>
            ))}
          </div>
        ) : (
          <p className="p15-mini-empty">Nothing picked yet</p>
        )}
      </MiniTile>

      <MiniTile icon={<Accessibility />} title="Getting around" active={activeStep === 4} person={person}>
        <dl className="p15-mini-dl">
          <div>
            <dt>Mobility</dt>
            <dd>{MOBILITY_PHRASE[draft.mobility]}</dd>
          </div>
          <div>
            <dt>Step-free entrances</dt>
            <dd>{needsStepFree ? 'Needed' : 'Not needed'}</dd>
          </div>
          <div>
            <dt>Walking at one time</dt>
            <dd>{draft.maxWalkMinutes === undefined ? <NotYet /> : walkLabel(draft.maxWalkMinutes)}</dd>
          </div>
          <div>
            <dt>Tickets</dt>
            <dd>{draft.tickets ? TICKET_PHRASE[draft.tickets] : <NotYet />}</dd>
          </div>
        </dl>
        {draft.otherNeeds.trim() && <p className="p15-mini-note">“{draft.otherNeeds.trim()}”</p>}
      </MiniTile>
    </div>
  );
}
