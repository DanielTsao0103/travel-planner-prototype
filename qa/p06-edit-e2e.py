"""
Page 5 + Page 6 (edit mode) end-to-end checks.

Page 5: decline (with inline confirm) and accept an invitation (→ survey with trip/return),
        a Viewer's locked "Add event", past trips open their itinerary.
Page 6: move the whole trip (events + Day-editor assignment move along),
        shorten it (events outside the dates block saving), Viewer is locked out.

Usage: python3 qa/p06-edit-e2e.py
"""

from __future__ import annotations

import datetime as dt
import json
import sys

from playwright.sync_api import Page, sync_playwright

BASE = "http://127.0.0.1:5188/travel-planner-prototype/"
TRIP = "trip-sample-p-maya"
failures = 0


def check(label: str, ok: bool) -> None:
    global failures
    print(f"{'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        failures += 1


def goto(page: Page, route: str) -> None:
    page.goto(f"{BASE}#{route}", wait_until="networkidle")
    page.wait_for_timeout(500)


def state(page: Page) -> dict:
    page.wait_for_timeout(300)  # the store writes to localStorage after a short delay
    return json.loads(page.evaluate("() => localStorage.getItem('wayfare-prototype-state-v3')"))


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(1440, 900), (390, 844)]:
            tag = f"[{width}]"
            ctx = browser.new_context(viewport={"width": width, "height": height}, is_mobile=width < 768, has_touch=width < 768)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))

            # ------------------------------------------------ Page 5: invitations
            goto(page, "/trips?auth=maya")
            invite = page.locator(".p05-invite")
            check(f"{tag} invitation from Priya listed", invite.count() == 1 and "Priya Nair invited you" in invite.inner_text())
            page.get_by_role("button", name="Decline the invitation to Mexico City Food Week").click()
            check(f"{tag} decline asks first", page.get_by_text("Decline Priya’s invitation?").is_visible())
            page.get_by_role("button", name="Keep it").click()
            check(f"{tag} 'Keep it' returns to Accept/Decline", page.get_by_role("button", name="Accept the invitation to Mexico City Food Week").is_visible())
            page.get_by_role("button", name="Accept the invitation to Mexico City Food Week").click()
            page.wait_for_timeout(600)
            h = page.evaluate("location.hash")
            check(f"{tag} accept → survey with trip + return", h.startswith("#/survey?") and "trip=trip-mexico-p-maya" in h and "return=" in h)
            goto(page, "/trips")
            check(f"{tag} accepted trip now in Upcoming", page.locator("#p05-upcoming").get_by_text("Mexico City Food Week").count() == 1)
            check(f"{tag} no invitations left", page.locator(".p05-invite").count() == 0)

            # Viewer's locked Add event (Kauai, Maya is a Viewer)
            kauai = page.locator("article.trip-card").filter(has_text="Kauai Family Christmas")
            locked = kauai.locator("button.is-locked")
            check(f"{tag} Kauai: Add event is locked for a Viewer", locked.count() == 1)
            locked.click(force=True)  # aria-disabled, but tapping still explains why
            check(f"{tag} locked tap explains why", page.get_by_text("You’re a Viewer on this trip. Ask Kevin to make you an Editor.").first.is_visible())

            # Past trips: no Add event, and they open their itinerary
            nyc = page.locator("article.trip-card").filter(has_text="NYC Birthday Weekend")
            check(f"{tag} past trip has no Add event", nyc.get_by_text("Add event").count() == 0)
            nyc.get_by_role("link", name="View the itinerary for NYC Birthday Weekend").click()
            page.wait_for_timeout(400)
            check(f"{tag} past trip opens Page 8", page.evaluate("location.hash") == "#/trip/trip-nyc")

            # --------------------------------------- Page 6: move the whole trip
            s0 = state(page)
            trip0 = next(t for t in s0["trips"] if t["id"] == TRIP)
            ev0 = {e["id"]: e["date"] for e in s0["events"] if e["tripId"] == TRIP}
            sam0 = next(m for m in trip0["members"] if m["personId"] == "p-sam")["days"]
            goto(page, f"/trip/{TRIP}/edit")
            start = dt.date.fromisoformat(trip0["startDate"])
            new_start = (start + dt.timedelta(days=3)).isoformat()
            page.get_by_label("Start date").fill(new_start)
            page.wait_for_timeout(200)
            new_end = (dt.date.fromisoformat(trip0["endDate"]) + dt.timedelta(days=3)).isoformat()
            check(f"{tag} end date moves with the start", page.get_by_label("End date").input_value() == new_end)
            move = page.get_by_role("checkbox", name="Move all events with the new dates")
            check(f"{tag} 'Move all events' offered and on", move.count() == 1 and move.is_checked())
            page.get_by_role("button", name="Save changes").click()
            page.wait_for_url(f"**/#/trip/{TRIP}", timeout=6000)
            s1 = state(page)
            trip1 = next(t for t in s1["trips"] if t["id"] == TRIP)
            ev1 = {e["id"]: e["date"] for e in s1["events"] if e["tripId"] == TRIP}
            shifted = all(dt.date.fromisoformat(ev1[i]) - dt.date.fromisoformat(d) == dt.timedelta(days=3) for i, d in ev0.items() if i in ev1)
            check(f"{tag} trip dates moved", trip1["startDate"] == new_start and trip1["endDate"] == new_end)
            check(f"{tag} every event moved 3 days", shifted)
            sam1 = next(m for m in trip1["members"] if m["personId"] == "p-sam")["days"]
            check(f"{tag} Sam keeps his (moved) Day 3", sam1 == [(dt.date.fromisoformat(sam0[0]) + dt.timedelta(days=3)).isoformat()])

            # ------------------------------ Page 6: shorten → events outside the dates
            goto(page, f"/trip/{TRIP}/edit")
            shorter = (dt.date.fromisoformat(new_end) - dt.timedelta(days=2)).isoformat()
            page.get_by_label("End date").fill(shorter)
            page.wait_for_timeout(200)
            msg = page.locator(".p06-outside .field-error")
            check(f"{tag} shortening lists events outside the dates", msg.count() == 1 and "outside these dates. Move or delete them first." in msg.inner_text())
            page.get_by_role("button", name="Save changes").click()
            page.wait_for_timeout(300)
            check(f"{tag} can't save with events outside", page.evaluate("location.hash").endswith("/edit"))

            # ------------------------------------------ Page 6: Viewer locked out
            goto(page, f"/trip/{TRIP}/edit?as=viewer")
            check(f"{tag} Viewer sees the locked summary", page.get_by_text("Only the trip owner can edit this").is_visible())
            check(f"{tag} Viewer has no form", page.get_by_role("button", name="Save changes").count() == 0)
            goto(page, "/trips?as=owner")

            for e in errors:
                check(f"{tag} page error: {e}", False)
            ctx.close()
        browser.close()
    print("ALL PASS" if failures == 0 else f"{failures} FAILURE(S)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
