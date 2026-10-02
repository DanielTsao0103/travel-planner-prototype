/**
 * Requirement → screen checklist (plan §3). Requirements come from Step 3+ of
 * the source doc and the brief; assumptions are listed separately (plan §6).
 */

export interface Requirement {
  page: number | 'All';
  text: string;
  screens: string[];
  how: string;
}

export const REQUIREMENTS: Requirement[] = [
  { page: 1, text: 'Defaults to Log in; “New here? Create an Account” switches to sign-up', screens: ['1A', '1B'], how: 'Toggle link under the form' },
  { page: 1, text: 'Google, Apple, and email/password in both modes', screens: ['1A', '1B'], how: 'Three options on both forms' },
  { page: 1, text: 'Wrong password vs. email not on file, explained specifically', screens: ['1C', '1D'], how: 'Inline errors under the field that’s wrong' },
  { page: 1, text: 'Unknown Google/Apple user is prompted to create an account', screens: ['1E', '1F'], how: 'Simulated chooser → “No account, create one?”' },
  { page: 2, text: 'Shown only after creating an account', screens: ['2A'], how: 'Sign-up → Page 2; log in skips it' },
  { page: 2, text: 'Instagram, Facebook, TikTok, Gmail checklist with status and granted/needed permissions', screens: ['2A', '2B', '2C'], how: 'Status chip + ✓ granted / ○ needed per permission' },
  { page: 2, text: 'Skip shows a warning listing the features you’d miss', screens: ['2D'], how: 'Per-service list of lost features' },
  { page: 2, text: 'Signing in with Google doesn’t imply Gmail access', screens: ['2A', '3A'], how: 'Separate Gmail consent with its own permissions' },
  { page: 3, text: 'Selecting a service opens a simulated provider authorization, then returns to Page 2 updated', screens: ['3A', '3B', '3C'], how: 'Consent sheet → connecting → back to checklist' },
  { page: 3, text: 'Success, canceled, and failed outcomes', screens: ['3C', '3D', '3E'], how: 'Allow / Cancel / demo failure' },
  { page: 4, text: '3-line menu: Budget (12), Calendar (11), Map (17), Collaborators (13), Pre-planned trips (coming soon)', screens: ['4C', '4D'], how: 'Menu names the trip its links open' },
  { page: 4, text: 'Full-width “+ New Trip” → Page 6 and “Open existing trip” → Page 5', screens: ['4A'], how: 'Two full-width buttons' },
  { page: 4, text: 'Three suggested destinations with images, estimated cost, and suggested length', screens: ['4A', '4E'], how: '“Plan this trip” prefills Page 6' },
  { page: 4, text: 'Trip-specific menu items work when no trip is selected', screens: ['11E'], how: 'Current-trip rule + “Pick a trip” state' },
  { page: 5, text: 'Every trip created or accepted, including past trips', screens: ['5A', '5E'], how: 'Happening now / Upcoming / Past / Pending invitations' },
  { page: 5, text: 'Opening a trip goes to its itinerary; Add event goes to Page 7 with the trip selected', screens: ['5A', '7A'], how: 'Card actions' },
  { page: 6, text: 'Title with a gray example placeholder (“Bachelorette trip”)', screens: ['6A'], how: 'Placeholder text' },
  { page: 6, text: 'One or more destinations; at least one required', screens: ['6B', '6C'], how: 'Destination chips + validation' },
  { page: 6, text: 'Invite people; invitees start as Viewers; permissions set on Page 13', screens: ['6C', '13D'], how: 'Invite list with Viewer badges' },
  { page: 6, text: 'Saved trips appear on Page 5 and can be edited later', screens: ['5D', '6E'], how: 'Highlight on Page 5; Edit trip (Owner)' },
  { page: 7, text: 'Manual where, when, cost, who', screens: ['7A'], how: 'Form with live place search' },
  { page: 7, text: 'How busy the place usually is at that time', screens: ['7B'], how: 'Hourly crowd estimate, labeled illustrative' },
  { page: 7, text: 'Upload a confirmation screenshot, review extracted details, fill gaps', screens: ['7D', '7E', '7F', '7G'], how: 'Simulated extraction with missing fields highlighted' },
  { page: 7, text: 'Saving adds the event to the right trip and day', screens: ['8C'], how: 'Itinerary scrolls to and highlights it' },
  { page: 8, text: 'Chronological list grouped “Day N — MM/DD”; photo, name, “@ time”; empty days', screens: ['8A', '8B'], how: 'Day groups, time-ordered' },
  { page: 9, text: 'Suggestions use location, planned places, free time, and interests', screens: ['9A', '9G', '9H'], how: 'Context bar + fit chips' },
  { page: 9, text: '“Since you planned … you might also like …”', screens: ['9A'], how: 'Reason on every card' },
  { page: 9, text: 'Accept or decline; choose day and time; conflicts visible', screens: ['9B', '9C', '9D'], how: 'Day/time picker with overlap warning' },
  { page: 10, text: 'Opens automatically during the trip (demo date control)', screens: ['10A', '10B', '10C', '10D'], how: 'Auto-open once per launch' },
  { page: 10, text: 'Week calendar, to-do beside it (desktop), map below; day → Page 11', screens: ['10A'], how: 'Mobile: day strip → to-do → map card' },
  { page: 11, text: 'Detailed time breakdown; add/edit by permission; consistent with Pages 8 and 10', screens: ['11A', '11B', '11C', '11D'], how: 'One shared data store' },
  { page: 12, text: 'Categorized spending, expense log, total spent, remaining (Ramp-like hierarchy)', screens: ['12A', '12B'], how: 'Pie on the left, summary bar at the bottom' },
  { page: 12, text: 'Manual expenses (amount, purpose, category) and receipt scanning', screens: ['12C', '12D'], how: 'Add sheet + scan flow' },
  { page: 12, text: 'Simulated Gmail receipt matching and transaction notifications, labeled demo', screens: ['12E', '12F', '12K'], how: 'Review cards marked “Demo data”' },
  { page: 12, text: '“I paid for…” + simulated notify; “Name 1 owes Name 2 $000.00” log; requester marks done', screens: ['12C', '12G'], how: 'Only the person owed sees “Mark as paid”' },
  { page: 12, text: 'Host chooses group or individual budgets (and sets the amount)', screens: ['12A', '12B', '12H', '12J'], how: 'Owner-only settings' },
  { page: 13, text: 'Dietary tiles: restrictions, local vs. familiar, spending, extravagant vs. simple, atmosphere', screens: ['13A'], how: 'Aggregated from surveys' },
  { page: 13, text: 'Travel preferences and limitations: wheelchair, walking, tickets, modern/historic/cultural', screens: ['13B'], how: 'Aggregated from surveys + itinerary' },
  { page: 13, text: 'Collaborators: Owner, Editor, Viewer, day-specific; host adds/removes/manages', screens: ['13C', '13D', '13E', '13F', '13G'], how: 'Owner-only controls' },
  { page: 15, text: 'Survey collects everything Page 13 shows; saving/editing updates Page 13', screens: ['15A', '15B', '15C', '15D', '15E', '15G', '15H'], how: 'Stepper → tiles recompute' },
  { page: 16, text: 'Contextual pop-up for a nearby match (~500 ft; ~5-min walk) with Go / No', screens: ['16A', '16B'], how: 'Shows distance and walk time separately' },
  { page: 16, text: 'Go opens the map with the route; No dismisses', screens: ['17B', '16B'], how: '' },
  { page: 17, text: 'Surroundings, simulated location, places, and route in a Google-Maps-style map', screens: ['17A', '17B', '17C', '17D', '17E'], how: 'OpenStreetMap; location labeled simulated' },
  { page: 'All', text: 'Distinct desktop (1440) and mobile (390) layouts; no horizontal overflow', screens: [], how: 'Verified by the Playwright sweep' },
  { page: 'All', text: 'Viewers clearly can’t edit; nothing real is sent, charged, or accessed', screens: ['8D', '11C', '13G'], how: 'Locked controls explain why when tapped' },
];
