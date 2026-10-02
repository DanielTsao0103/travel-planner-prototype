/**
 * The five survey steps (Page 15). Each step only renders questions; the
 * page (SurveyPage.tsx) owns the draft, navigation, validation, and saving.
 */

import type { ReactNode } from 'react';
import { CircleCheck, Pencil } from 'lucide-react';
import type { Person } from '../../data/types';
import { Button } from '../../components/ui/Button';
import { ChipToggle, Field, Switch, TextArea } from '../../components/ui/Field';
import { ChoiceGroup, InlineError, QuestionBlock, RadioCards, ScaleChoice } from './controls';
import { toggleAllergy, toggleIn, type StepErrors, type SurveyDraft } from './draft';
import { GroupPreview } from './GroupPreview';
import {
  ACTIVITY_OPTIONS,
  ALLERGY_LABEL,
  ALLERGY_OPTIONS,
  ATMOSPHERE_LABEL,
  ATMOSPHERE_OPTIONS,
  DIET_OPTIONS,
  FANCY_SCALE,
  INTEREST_LABEL,
  LOCAL_SCALE,
  MOBILITY_OPTIONS,
  normalizeInterests,
  SEVERITY_OPTIONS,
  SIGHT_OPTIONS,
  spendOption,
  SPEND_OPTIONS,
  STEPS,
  TICKET_OPTIONS,
  WALK_OPTIONS,
  walkLabel,
  type Option,
  type StepNumber,
} from './vocab';
import type { InterestTag } from '../../data/types';

/** Props every question step receives. `patch` merges changes into the draft. */
export interface StepProps {
  draft: SurveyDraft;
  patch: (changes: Partial<SurveyDraft>) => void;
  /** Errors to show right now (empty until the person tries to continue). */
  errors: StepErrors;
}

/** Render an option's lucide icon at chip size (ChipToggle shows it until selected). */
function chipIcon<T>(o: Option<T>): ReactNode {
  const Icon = o.icon;
  return Icon ? <Icon aria-hidden /> : undefined;
}

/* ------------------------------------------------------- step 1: food */

/** Step 1: diets, allergies (with Mild / Severe), or "No restrictions", plus a food note. */
export function StepFood({ draft, patch, errors }: StepProps) {
  const errorId = errors.food ? 'p15-food-error' : undefined;
  const chosenAllergies = ALLERGY_OPTIONS.filter((o) => draft.allergies.some((a) => a.item === o.value));

  return (
    <div className="p15-step-body">
      <div className={`p15-none ${draft.noRestrictions ? 'is-on' : ''}`}>
        <ChipToggle
          selected={draft.noRestrictions}
          onToggle={() => patch(draft.noRestrictions ? { noRestrictions: false } : { noRestrictions: true, diet: [], allergies: [] })}
          icon={<CircleCheck aria-hidden />}
        >
          No restrictions
        </ChipToggle>
        <span className="p15-hint">Nothing to avoid? Choose this and continue.</span>
      </div>
      {errors.food && <InlineError id={errorId}>{errors.food}</InlineError>}

      <fieldset className="p15-fieldset" aria-describedby={errorId}>
        <legend className="p15-q-title">Diet</legend>
        <p className="p15-hint">Pick all that apply.</p>
        <div className="p15-chips">
          {DIET_OPTIONS.map((o) => (
            <ChipToggle key={o.value} selected={draft.diet.includes(o.value)} onToggle={() => patch({ diet: toggleIn(draft.diet, o.value), noRestrictions: false })} icon={chipIcon(o)}>
              {o.label}
            </ChipToggle>
          ))}
        </div>
      </fieldset>

      <fieldset className="p15-fieldset" aria-describedby={errorId}>
        <legend className="p15-q-title">Food allergies</legend>
        <p className="p15-hint">Pick any you have, then say how serious each one is.</p>
        <div className="p15-chips">
          {ALLERGY_OPTIONS.map((o) => (
            <ChipToggle
              key={o.value}
              selected={draft.allergies.some((a) => a.item === o.value)}
              onToggle={() => patch({ allergies: toggleAllergy(draft.allergies, o.value), noRestrictions: false })}
              icon={chipIcon(o)}
            >
              {o.label}
            </ChipToggle>
          ))}
        </div>
        {chosenAllergies.length > 0 && (
          <div className="p15-severity">
            <ul className="p15-severity-list">
              {chosenAllergies.map((o) => {
                const current = draft.allergies.find((a) => a.item === o.value)!;
                const labelId = `p15-sev-${o.value}`;
                return (
                  <li key={o.value} className="p15-severity-row">
                    <span id={labelId} className="p15-severity-name">
                      {o.label}
                      <span className="sr-only"> allergy: how serious?</span>
                    </span>
                    <ChoiceGroup
                      className="p15-choice-compact"
                      ids={{ labelId, describedBy: 'p15-sev-hint' }}
                      options={SEVERITY_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                      value={current.severity}
                      onChange={(severity) => patch({ allergies: draft.allergies.map((a) => (a.item === o.value ? { ...a, severity } : a)) })}
                    />
                  </li>
                );
              })}
            </ul>
            <p id="p15-sev-hint" className="p15-hint">
              <strong>Severe:</strong> even a trace is dangerous. <strong>Mild:</strong> avoid it, but a trace isn’t dangerous.
            </p>
          </div>
        )}
      </fieldset>

      <Field label="Anything else about food?" aside="Optional" hint="Your group sees this note.">
        {(p) => (
          <TextArea
            {...p}
            rows={3}
            value={draft.dietNotes}
            onChange={(e) => patch({ dietNotes: e.target.value })}
            placeholder="For example: carries an EpiPen, or needs a dedicated gluten-free kitchen"
          />
        )}
      </Field>
    </div>
  );
}

/* ----------------------------------------------- step 2: dining style */

/** Step 2: local vs. familiar, simple vs. extravagant, spend per meal, atmosphere. */
export function StepDining({ draft, patch }: StepProps) {
  return (
    <div className="p15-step-body">
      <QuestionBlock id="p15-q-local" title="Local delights or a taste of home?" hint="Local delights are the city’s own specialties. Taste of home is food like you’d eat at home.">
        {(ids) => <ScaleChoice scale={LOCAL_SCALE} value={draft.localVsFamiliar} onChange={(v) => patch({ localVsFamiliar: v })} ids={ids} />}
      </QuestionBlock>

      <QuestionBlock id="p15-q-fancy" title="Simple or extravagant?" hint="From quick, simple meals to special-occasion dining.">
        {(ids) => <ScaleChoice scale={FANCY_SCALE} value={draft.simpleVsExtravagant} onChange={(v) => patch({ simpleVsExtravagant: v })} ids={ids} />}
      </QuestionBlock>

      <QuestionBlock id="p15-q-spend" title="Spend per meal" hint="Per person, for a typical sit-down meal.">
        {(ids) => (
          <ChoiceGroup
            className="p15-spend"
            ids={ids}
            value={draft.mealBudget}
            onChange={(v) => patch({ mealBudget: v })}
            options={SPEND_OPTIONS.map((o) => ({
              value: o.value,
              ariaLabel: `${o.range} per person`,
              label: (
                <>
                  <span className="p15-spend-symbol num">{o.symbol}</span>
                  <span className="p15-spend-range num">{o.range}</span>
                </>
              ),
            }))}
          />
        )}
      </QuestionBlock>

      <fieldset className="p15-fieldset">
        <legend className="p15-q-title">Restaurant atmosphere</legend>
        <p className="p15-hint">Pick any you enjoy. Optional.</p>
        <div className="p15-chips">
          {ATMOSPHERE_OPTIONS.map((o) => (
            <ChipToggle key={o.value} selected={draft.atmosphere.includes(o.value)} onToggle={() => patch({ atmosphere: toggleIn(draft.atmosphere, o.value) })}>
              {o.label}
            </ChipToggle>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/* -------------------------------------------------- step 3: interests */

/** Step 3: sights (modern, ancient, cultural…) and things to do. */
export function StepInterests({ draft, patch }: StepProps) {
  const picked = normalizeInterests(draft.interests);

  // "Ancient & historic" stores 'historic'; turning it off also clears the older 'ancient' alias.
  const toggle = (value: InterestTag) => {
    if (picked.includes(value)) {
      patch({ interests: draft.interests.filter((i) => i !== value && !(value === 'historic' && i === 'ancient')) });
    } else {
      patch({ interests: [...draft.interests, value] });
    }
  };

  const group = (legend: string, hint: string, options: Option<InterestTag>[]) => (
    <fieldset className="p15-fieldset">
      <legend className="p15-q-title">{legend}</legend>
      <p className="p15-hint">{hint}</p>
      <div className="p15-chips">
        {options.map((o) => (
          <ChipToggle key={o.value} selected={picked.includes(o.value)} onToggle={() => toggle(o.value)} icon={chipIcon(o)}>
            {o.label}
          </ChipToggle>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="p15-step-body">
      {group('Sights', 'Modern, ancient, cultural: what kind of places do you want to see?', SIGHT_OPTIONS)}
      {group('Things to do', 'Pick as many as you like.', ACTIVITY_OPTIONS)}
      <p className="p15-count" aria-live="polite">
        {picked.length === 0 ? 'Nothing picked yet. That’s OK, it’s optional.' : `${picked.length} picked`}
      </p>
    </div>
  );
}

/* ------------------------------------------ step 4: accessibility & limits */

/** Step 4: mobility aid, step-free entrances, walking limit, tickets, other needs. */
export function StepAccess({ draft, patch, errors }: StepProps) {
  return (
    <div className="p15-step-body">
      <RadioCards
        name="p15-mobility"
        legend="Do you use a mobility aid?"
        layout="grid"
        options={MOBILITY_OPTIONS}
        value={draft.mobility}
        // Wheelchair users almost always need step-free entrances, so switch that on for them.
        onChange={(mobility) => patch({ mobility, stepFreeNeeded: mobility.startsWith('wheelchair') ? true : draft.stepFreeNeeded })}
      />

      <div className="p15-switch-card">
        <Switch label="I need step-free entrances" description="No stairs or steep steps to get in. Planners check each stop for this." checked={draft.stepFreeNeeded} onChange={(v) => patch({ stepFreeNeeded: v })} />
      </div>

      <QuestionBlock
        id="p15-q-walk"
        title="How long can you comfortably walk at one time?"
        hint="Planners use the shortest limit in the group to space out stops."
        required
        error={errors.walk}
      >
        {(ids) => (
          <ChoiceGroup
            className="p15-walk"
            ids={ids}
            invalid={!!errors.walk}
            value={draft.maxWalkMinutes}
            onChange={(v) => patch({ maxWalkMinutes: v })}
            options={WALK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        )}
      </QuestionBlock>

      <RadioCards
        name="p15-tickets"
        legend="Places that need tickets booked ahead"
        hint="Some museums and palaces sell timed entry only."
        options={TICKET_OPTIONS}
        value={draft.tickets}
        onChange={(tickets) => patch({ tickets })}
        error={errors.tickets}
        required
      />

      <Field label="Anything else planners should know?" aside="Optional" hint="Your group sees this note.">
        {(p) => (
          <TextArea
            {...p}
            rows={3}
            value={draft.otherNeeds}
            onChange={(e) => patch({ otherNeeds: e.target.value })}
            placeholder="For example: needs a rest break after lunch, or gets seasick"
          />
        )}
      </Field>
    </div>
  );
}

/* ------------------------------------------------------ step 5: review */

/** One answer line in the review list; `missing` shows a red "Not answered yet". */
function ReviewItem({ term, children, missing }: { term: string; children?: ReactNode; missing?: boolean }) {
  return (
    <div className="p15-review-item">
      <dt>{term}</dt>
      <dd>{missing ? <span className="p15-review-missing">Not answered yet</span> : children}</dd>
    </div>
  );
}

/** "None" in muted text, for empty optional answers. */
function None({ children = 'None' }: { children?: string }) {
  return <span className="muted">{children}</span>;
}

/** One step’s answers in the review, with an Edit button that jumps back to it. */
function ReviewSection({ step, onEdit, children }: { step: StepNumber; onEdit: (n: StepNumber) => void; children: ReactNode }) {
  const meta = STEPS[step - 1];
  return (
    <section className="p15-review-section" aria-labelledby={`p15-review-${step}`}>
      <div className="p15-review-head">
        <h3 id={`p15-review-${step}`} className="p15-review-title">
          <span className="p15-review-num num" aria-hidden>
            {step}
          </span>
          {meta.short}
        </h3>
        <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => onEdit(step)} aria-label={`Edit ${meta.short.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      <dl className="p15-review-list">{children}</dl>
    </section>
  );
}

/** Step 5: every answer, grouped by step, plus how the group will see them. */
export function StepReview({ draft, person, onEdit, showPreview }: { draft: SurveyDraft; person: Person; onEdit: (n: StepNumber) => void; showPreview: boolean }) {
  const interests = normalizeInterests(draft.interests);
  const sights = interests.filter((i) => SIGHT_OPTIONS.some((o) => o.value === i));
  const activities = interests.filter((i) => ACTIVITY_OPTIONS.some((o) => o.value === i));
  const spend = spendOption(draft.mealBudget);
  const foodMissing = !draft.noRestrictions && draft.diet.length === 0 && draft.allergies.length === 0;

  return (
    <div className="p15-step-body p15-review">
      <ReviewSection step={1} onEdit={onEdit}>
        <ReviewItem term="Diet" missing={foodMissing}>
          {draft.noRestrictions ? 'No restrictions' : draft.diet.length ? draft.diet.map((d) => DIET_OPTIONS.find((o) => o.value === d)?.label).join(', ') : <None />}
        </ReviewItem>
        {!draft.noRestrictions && (
          <ReviewItem term="Allergies">
            {draft.allergies.length ? draft.allergies.map((a) => `${ALLERGY_LABEL[a.item]} (${a.severity})`).join(', ') : <None />}
          </ReviewItem>
        )}
        <ReviewItem term="Food note">{draft.dietNotes.trim() || <None />}</ReviewItem>
      </ReviewSection>

      <ReviewSection step={2} onEdit={onEdit}>
        <ReviewItem term="Local or familiar">{LOCAL_SCALE.labels[draft.localVsFamiliar]}</ReviewItem>
        <ReviewItem term="Simple or extravagant">{FANCY_SCALE.labels[draft.simpleVsExtravagant]}</ReviewItem>
        <ReviewItem term="Spend per meal">
          <span className="num">
            {spend.symbol} · {spend.range}
          </span>
        </ReviewItem>
        <ReviewItem term="Atmosphere">{draft.atmosphere.length ? draft.atmosphere.map((a) => ATMOSPHERE_LABEL[a]).join(', ') : <None>No preference</None>}</ReviewItem>
      </ReviewSection>

      <ReviewSection step={3} onEdit={onEdit}>
        <ReviewItem term="Sights">{sights.length ? sights.map((i) => INTEREST_LABEL[i]).join(', ') : <None>None picked</None>}</ReviewItem>
        <ReviewItem term="Things to do">{activities.length ? activities.map((i) => INTEREST_LABEL[i]).join(', ') : <None>None picked</None>}</ReviewItem>
      </ReviewSection>

      <ReviewSection step={4} onEdit={onEdit}>
        <ReviewItem term="Mobility aid">{MOBILITY_OPTIONS.find((o) => o.value === draft.mobility)?.label}</ReviewItem>
        <ReviewItem term="Step-free entrances">{draft.stepFreeNeeded ? 'Needed' : 'Not needed'}</ReviewItem>
        <ReviewItem term="Walking at one time" missing={draft.maxWalkMinutes === undefined}>
          {draft.maxWalkMinutes !== undefined && walkLabel(draft.maxWalkMinutes)}
        </ReviewItem>
        <ReviewItem term="Tickets" missing={!draft.tickets}>
          {TICKET_OPTIONS.find((o) => o.value === draft.tickets)?.label}
        </ReviewItem>
        <ReviewItem term="Other needs">{draft.otherNeeds.trim() || <None />}</ReviewItem>
      </ReviewSection>

      {showPreview && (
        <section className="p15-review-preview" aria-labelledby="p15-sees-title">
          <h3 id="p15-sees-title" className="p15-review-title">
            How the group sees this
          </h3>
          <p className="p15-hint">Your answers join everyone else’s on each trip’s People page.</p>
          <GroupPreview draft={draft} person={person} />
        </section>
      )}
    </div>
  );
}
