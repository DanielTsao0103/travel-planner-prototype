# Architecture & page-building guide

This prototype is a Vite + React 19 + TypeScript app. Read this before building or changing a page.

## Ground rules

- **Pages live in `src/pages/pNN/`.** A page folder owns its components, helpers, and CSS. Don't edit files outside your folder (plus your screen registry `src/proto/screens/pNN.ts`). If you need a shared change (store action, selector, shared component), write a local helper in your folder and say so in your final report.
- **Never mutate state directly.** Read with selectors (`src/store/selectors.ts`), change with actions (`src/store/actions.ts`). For something truly page-specific, `update((draft) => {...})` from `src/store/store.ts` is the escape hatch. Keep it rare and commented.
- **Colors come from tokens only** (`src/styles/tokens.css`), e.g. `var(--primary)`, `var(--surface)`, `var(--muted)`. Never write hex/rgb literals in page CSS: the app has a dark theme.
- **CSS class names are prefixed with your page id**, e.g. `.p08-day-header`, in `src/pages/p08/p08.css`, imported by your page component.
- **No new npm dependencies.** Available: react, react-dom, leaflet, lucide-react.
- **Write for a learner.** Dan is learning to code: every component/function gets a short JSDoc, props get TypeScript types, and non-obvious logic gets a one-line comment.
- **Don't run `npm install`, start/stop servers, or `git commit`.** A dev server is already running at http://127.0.0.1:5188/travel-planner-prototype/

## Layout system

- `useBreakpoint()` → `'mobile' | 'tablet' | 'desktop'` (<768, 768–1099, ≥1100). Design **distinct** mobile (390px reference) and desktop (1440px reference) layouts. Don't just shrink the desktop. Tablet can usually reuse desktop with fewer columns.
- `.container` = centered 1200px column with the responsive side gutter (16/24/32px). `.page` = standard vertical padding (on phones it also leaves room for the bottom tab bar).
- Utilities in `src/styles/base.css`: `.stack`, `.stack-sm/md/lg/xl`, `.cluster`, `.row`, `.row-between`, `.grow`, `.eyebrow`, `.muted`, `.small`, `.xsmall`, `.num` (tabular numerals for money), `.truncate`, `.sr-only`, `.surface`.
- Trip pages (itinerary, ideas, dashboard, day, budget, people, trip map) automatically get the trip tabs (desktop) / bottom tab bar (mobile) from `AppShell`. The header already has the 3-line menu, trip switcher, account menu, and Prototype pill.
- **No horizontal overflow at 390px.** Give flex/grid children that hold text `min-width: 0`. Wide tables go inside an `overflow-x: auto` wrapper.
- Touch targets ≥ 44px on mobile. Inputs are 16px font (prevents iOS zoom).

## Visual direction ("Open Air")

A crisp daylight UI where travel photography carries the color.
- **Palette:** cool off-white ground (`--bg`), white surfaces, ink text, harbor-teal primary (`--primary`), and marigold accent (`--accent`) for "today/live/highlight" only.
- **Type:** display headings use Bricolage Grotesque (`h1`, `h2`, `.h1`, `.h2`, or `font-family: var(--font-display)`); UI text uses Figtree.
- **Shape:** rounded photos and sheets; rows, lists, and tables stay flatter. Don't put a card border + shadow on everything. Use borders/fills by role.
- **Avoid:** gradients as decoration, emoji, accent bars on the left of cards, centered-everything layouts.
- **Copy:** plain, active, specific. Buttons say what happens ("Add to Day 2", "Save trip"). Errors say what's wrong and how to fix it. No apologies, no em-dash asides, no "not X but Y" phrasing.

## Shared components (import from these paths)

`src/components/ui/Button.tsx`
- `Button`: props `variant` (primary | secondary | ghost | danger | accent | subtle), `size` (sm | md | lg), `block`, `icon`, `iconRight`, `loading`, `to` (in-app path), `href` (external), `locked="reason"`.
- **`locked`** renders a lock icon. Tapping it shows the reason in a toast, which is how we "clearly show when a viewer cannot edit".
- `IconButton` props: `label` (required), `icon`, `variant`, `size`, `to`, `locked`.

`src/components/ui/Field.tsx`
- `Field` uses a render prop: `<Field label error hint required aside>{(p) => <TextInput {...p} />}</Field>`.
- Inputs: `TextInput`, `TextArea`, `Select`, `MoneyInput`, `Checkbox`, `Switch`, `Segmented`, `ChipToggle`.

`src/components/ui/Display.tsx`
- `Badge` (tones: neutral, primary, accent, success, warning, danger, info), `RoleBadge`, `DemoBadge` (label anything simulated: "Simulated", "Demo data", "Estimate"), `Avatar`, `AvatarStack`.
- `Banner` (tones: info, success, warning, danger, locked, demo), `LockNote`, `EmptyState`, `Skeleton`, `Loading`, `Section`.

`src/components/ui/Overlay.tsx`
- `Sheet`: a dialog on desktop and a bottom sheet on mobile. Props: `variant="side"` for a right panel, `fullOnMobile`, `footer`, `size`.
- `Popover`, `Toaster` (already mounted).
- Toasts: `toast({ title, body?, tone?, action? })` from `src/store/toast.ts`.
- Menu item styles: `.menu-item`, `.menu-sep`.

`src/components/layout/PageHeader.tsx`
- `PageHeader` props: `title`, `subtitle`, `eyebrow`, `back={{to,label}}`, `actions`.

`src/components/domain/`
- `PlacePhoto` (photo id or URL, with a category-icon fallback) and `CategoryIcon`.
- `EventItem`: photo + name + "@ time" row; `eventLabel(event)`.
- `TripCard` and `PhaseBadge`.
- `MapView`: Leaflet + OSM. Props: `markers`, `you`, `route`, `routeEstimated`, `fit`, `onMarkerClick`, `static`. Give it a height via a class.

## Data & state

- Types: `src/data/types.ts` (Trip, TripEvent, Place, Expense, Reimbursement, Todo, SurveyResponse, Suggestion, Connection…).
- Store: `useAppState()` returns the whole `AppState`; components re-render on any change.
- `useTrip(tripId)` (`src/hooks/useTrip.ts`) returns `{ state, trip, access }` or `null` (not found / not a member: render an EmptyState with a link to My trips).
- `access` (`src/lib/permissions.ts` → `TripAccess`) fields:
  - `role`, `actingPersonId` (who "you" are; changes with "View as"), `isPast`
  - `canEditTrip`, `canManagePeople`, `canSetBudget`, `canEditAnyDay`, `canEditDay(date)`, `editableDays`, `canAddEvents`, `canManageTodos`, `canLogExpenses`
  - `lockReason(action)` returns a ready-made sentence for `locked=`.
- Key selectors (`src/store/selectors.ts`):
  - **Session and trips:** `currentPerson`, `getPerson`, `personName(s, id, actingId)` ("You" for the acting person), `personFirstName`, `now` / `today` (demo clock), `myTrips`, `pendingInvites`, `activeTrip`, `currentTrip`, `mySampleTrip`, `tripDays`, `phaseOf`.
  - **People:** `tripPeople`, `acceptedMemberIds`.
  - **Events and time:** `tripEvents`, `eventsOn`, `itineraryByDay`, `conflictsFor`, `freeGaps`.
  - **Location:** `simulatedLocation`, `nextEventToday`, `nextEventAnyDay`.
  - **Money:** `visibleExpenses` / `visibleReimbursements` (only dated ≤ demo today), `shareOf`.
  - **Suggestions:** `tripSuggestions`, `decisionFor`, `jumpTarget`.
- Actions (`src/store/actions.ts`):
  - **Auth and accounts:** `logIn`, `logInWithProvider`, `signUp`, `logOut`, `setConnectionResult`, `disconnectService`, `finishOnboarding`.
  - **Trips and people:** `createTrip`, `updateTrip`, `shiftTripEvents`, `acceptInvite`, `declineInvite`, `inviteMember`, `setMemberRole`, `removeMember`.
  - **Events:** `addEvent`, `updateEvent`, `deleteEvent`, `restoreEvent`, `clearHighlights`.
  - **Suggestions:** `saveLiveSuggestions`, `declineSuggestion`, `undoSuggestionDecision`, `addSuggestionToTrip`.
  - **Budget:**
    - Expenses: `addExpense` (with `requestRepayment` to create "owes" rows and simulate notifying people), `updateExpense`, `deleteExpense`.
    - Repayments: `markReimbursementPaid(id, actingPersonId)` (only the person owed), `reopenReimbursement`.
    - Settings: `setBudgetMode`, `setGroupBudget`, `setPersonalBudget`.
    - Demo notifications: `pushDemoNotification`, `resolveDemoNotification`.
  - **To-dos and survey:** `addTodo`, `toggleTodo`, `updateTodo`, `deleteTodo`, `saveSurvey`.
  - **Demo and UI:** `setDemo`, `setClock`, `showNearby`, `dismissNearby`.
- Helpers:
  - `src/lib/dates.ts`: `formatMMDD`, `dayHeading` ("Day 3 — 10/17"), `formatTime`, `formatShortDate`, `formatDateRange`, `timeToMin`, `minToTime`, `rangesOverlap`, `tripPhase`, `dayNumber`, `relativeDays`, `addDays`, `eachDay`, `formatDuration`.
  - `src/lib/format.ts`: `money` ("$1,234.50"), `moneyWhole`, `splitEvenly`, `distanceLabel` ("450 ft"/"0.7 mi"), `firstName`, `initials`, `listJoin`, `plural`, `looksLikeEmail`.
  - `src/lib/geo.ts`: `distanceMeters`, `estimateWalkMinutes`, `NEARBY_RADIUS_M`, `NEARBY_MAX_WALK_MIN`.
  - `src/lib/busy.ts`: `estimateBusy(profile, date, time)` returns curve, label, and tip.
- Services (live, no keys, cached, never block the UI; always handle failure):
  - `src/services/places.ts`: `searchCities`, `searchPlaces(q, near[])`, `customPlace`.
  - `src/services/photos.ts`: `findPhoto(name, context)`.
  - `src/services/routing.ts`: `walkingRoute(from, to)`, which falls back to an estimate.
  - `src/services/overpass.ts`: `nearbyPlaces(center, radiusM, kinds)`.
  - `src/services/http.ts`: `simulateLatency(ms)` for simulated integrations (it respects the Prototype "Slow mode").
- Nearby (Page 16) logic: `src/features/nearby.ts` (`triggerNearby`, `matchReasons`).
- Routes: `src/router/routes.ts` → `paths.*()` builders (never hand-type URLs). `navigate(path)`, `Link`, `withQuery(path, params)`, `useRoute()` from `src/router/router.tsx`.
- Bundled data:
  - `src/data/places.ts`: `PLACES`, `getPlace`, `photoUrl`.
  - `src/data/destinations.ts`: home suggestions and a popular-cities fallback.
  - `src/data/services.ts`: connectable services and their permissions.
  - `src/data/seed.ts`: sample data, `DEMO_PASSWORD`, `MAYA_ACCOUNT_ID`, `sampleTripId(personId)`.

## The sample world (keep everything consistent with it)

- **"Lisbon & Porto Fall Getaway":** 7 days, starting 14 days after the real date the data was seeded.
  - Lisbon is Days 1–4; Day 3 is a Sintra day trip that Sam edits. Porto is Days 5–7.
  - **Day 6 is intentionally empty.**
- **People:** the signed-in user is Owner. Jordan Reyes is Editor (celiac, strict gluten-free; modern art; splurges). Sam Okafor is Day editor for Day 3 (severe tree-nut allergy; nature; budget-minded). Priya Nair is Viewer (vegetarian; quiet; prefers walk-in places). Linda Park is Viewer (folding wheelchair for longer distances; short walks ≤10 min; step-free; low-sodium; mild shellfish allergy). Diego Alvarez is invited but pending.
- **Demo clock "during":** Day 2 at 2:20 PM. The traveler just left Time Out Market; the next stop is Santa Justa Lift at 3:30 PM. The nearby match is Padaria Celeste, a fictional gluten-free and nut-free bakery about 450 ft away (~4 min walk).
- **Maya's other trips:**
  - Upcoming: Kauai (Viewer, Kevin hosts); Zion Weekend (Owner, brand new: no events, no budget amount).
  - Past: NYC (Editor) and Banff (Owner).
  - Pending invitation: Mexico City (from Priya).
- **Demo login:** `maya.chen@example.com` / `wayfare-demo`. New accounts get their own sample-trip copy plus the Mexico City invite.
- **Fictional vs. real:** restaurants, rentals, receipts, bank/Gmail items, and booking confirmations are fictional. Landmarks are real.

## Forced states for the screen index

Each page reads `query.get('s')` (and sometimes `tab`, `step`, `section`, `to`) to open a specific state directly. These keys are defined in `src/proto/screens/pNN.ts`. Implement every one listed for your page, keep the registry in sync if you rename a state, and make sure each state is also reachable through normal interaction. Global params (`auth`, `as`, `date`, `time`, `nearby`) are handled by `App.tsx`; don't handle them in pages.

## Checking your work

- Type check: `npx tsc -p . 2>&1 | grep "src/pages/pNN"`. Other agents are editing other folders at the same time, so ignore errors outside yours.
- Screenshots (fresh browser profile each run; saves PNGs you can open with the Read tool):
  `python3 qa/shot.py "/trip/trip-sample-p-maya?auth=maya&date=during" --name p08-main`
  Options: `--widths 390,1440`, `--full` for a full-page shot, `--click "Button name"`, `--dark`.
  - It prints console errors and horizontal overflow. Fix both.
  - Prefix `--name` with your page id.
- Maya's sample trip id is `trip-sample-p-maya`. Use the `auth=maya` param in screenshot routes.
- Check every state in your registry at both 390 and 1440, and at least one state in dark mode.
