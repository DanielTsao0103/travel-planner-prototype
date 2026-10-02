# Travel Planner Prototype (working name: Wayfare)

Clickable, high-fidelity prototype of a collaborative travel-planning app. Requirements come from **Step 3 onward** of the course Google Doc (Pages 1–13, 15, 16, 17; Page 14 doesn't exist in the source). The approved plan lives at `~/.claude/plans/glittery-tickling-cat.md`.

## Git & hosting (decided by Dan, 2026-10-01)
- **Public** repo: `DanielTsao0103/travel-planner-prototype`
- **Direct commits to `main`** (no feature branches/PRs)
- Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
- Live link: https://danieltsao0103.github.io/travel-planner-prototype/
- Commits use the GitHub noreply email (repo-local git config) so Dan's personal email stays private

## Stack
- Vite + React 19 + TypeScript (TS 7), plain CSS with design tokens (`src/styles/tokens.css`), Leaflet + OpenStreetMap for maps, lucide-react icons
- `npm run dev` (port 5173) · `npm run build` · `npm run typecheck`
- Hash routing (`#/trip/<id>/...`) so GitHub Pages deep links work

## Architecture (read `docs/ARCHITECTURE.md` before changing pages)
- One store (`src/store/store.ts`) → selectors (`selectors.ts`) → actions (`actions.ts`). Pages never mutate state directly.
- Sample trip "Lisbon & Porto Fall Getaway" is generated relative to the real date (`src/data/seed.ts`), starts 14 days out.
- Every account gets its own copy of the sample trip (as Owner) + a pending Mexico City invite.
- Live open data (no API keys) for tester-created trips: Photon search, Wikipedia photos, OSRM foot routing, Overpass — all cached, all with fallbacks.
- Prototype controls (demo clock, View as, simulations) are separate from app UI.
- Screen index (`#/proto/index`) deep-links every page/state; per-page registries in `src/proto/screens/pNN.ts`.

## Assets
- Photos: `python3 scripts/fetch_photos.py` (Wikimedia Commons, free licenses only, credits → `src/data/photoCredits.json`), then `python3 scripts/compress_photos.py`.

## QA
- `python3 qa/sweep.py` — Playwright sweep of every screen at 390×844 and 1440×900 (console errors, horizontal overflow, screenshots to `qa/screens/`).

## Corrections & Lessons Learned
- `sips -s formatOptions <n>` doesn't reliably apply JPEG quality; use Pillow (`scripts/compress_photos.py`).
- Wikipedia lead images for some subjects (e.g. Brooklyn Bridge, Bolhão) are panoramas or B&W — check the contact sheet and swap queries.
