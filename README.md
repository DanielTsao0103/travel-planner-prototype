# Wayfare (working name) — collaborative travel planner prototype

A clickable, high-fidelity prototype of a group travel-planning app, with separately designed desktop and phone layouts.

**Try it:** https://danieltsao0103.github.io/travel-planner-prototype/

- Log in as the returning demo user: `maya.chen@example.com` / `wayfare-demo`
- Or create a new account with any fictional name and email (nothing is sent anywhere)
- Every account includes a fully planned **sample trip** (Lisbon & Porto). You can also create your own trip to any city.
- **Prototype controls** (header pill on desktop, or the menu on phones) let you jump into a trip's dates, switch roles ("View as"), and trigger simulated events.
- **Screen index:** `#/proto/index` links to every page and state.
- **Screen collage:** https://danieltsao0103.github.io/travel-planner-prototype/collage/ shows every state on phone and desktop on one page.

## What's simulated

Everything external is simulated or uses free open data:
- Sign-in, Google/Apple, and social/Gmail connections are fake (no real accounts are touched)
- Receipt/screenshot reading, Gmail matching, bank alerts, and notifications are demo data
- Your location is simulated; maps and places come from OpenStreetMap and Wikipedia
- Photos: real photos from Wikimedia for sample places, ideas, and places you add when one exists; otherwise a generic photo tagged "Representative photo"
- No invitations or messages are sent and no money moves

## Production notes

- **Account enumeration:** the login page tells you whether an email exists (as the spec asks). Production should use one generic message plus rate limiting.
- **Gmail:** reading receipts needs a restricted Gmail scope, which requires Google verification and a security assessment. Signing in with Google doesn't grant it.
- **Instagram/Facebook/TikTok:** their public APIs don't expose a person's saved posts or Reels. Realistic imports would use the share sheet or pasted links.
- **Bank notifications:** iOS doesn't let apps read other apps' notifications, and Android access is policy-restricted. Use a bank-data aggregator with transaction webhooks, or forwarded alert emails.
- **Background location / geofencing** (nearby alerts) needs a native app.
- **Google Maps** needs an API key and billing, and "Popular times" isn't in the official API. Crowd levels here are illustrative.
- **Diet, allergy, and mobility answers** are health-related data. They need consent and visibility controls.

## Develop

```bash
npm install
npm run dev
```

Photo credits: see `#/proto/credits` in the app.
