"""
Page 6 end-to-end check: create a trip to a non-sample city with the LIVE city
search, then confirm it shows up (highlighted) on Page 5.

Usage:  python3 qa/p06-e2e.py
Saves screenshots to qa/screens/p06-e2e-*.png and prints PASS/FAIL lines.
"""

from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = "http://127.0.0.1:5188/travel-planner-prototype/"
OUT = Path(__file__).resolve().parent / "screens"


def check(label: str, ok: bool) -> bool:
    print(f"{'PASS' if ok else 'FAIL'}  {label}")
    return ok


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    failures = 0
    start = dt.date.today() + dt.timedelta(days=20)
    end = start + dt.timedelta(days=5)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(1440, 900), (390, 844)]:
            ctx = browser.new_context(viewport={"width": width, "height": height}, is_mobile=width < 768, has_touch=width < 768)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)

            page.goto(f"{BASE}#/trips/new?auth=maya", wait_until="networkidle")
            page.wait_for_timeout(500)

            # 1) Submitting the empty form shows every error and focuses the title.
            page.get_by_role("button", name="Create trip").click()
            page.wait_for_timeout(300)
            failures += not check(f"[{width}] empty submit shows the error summary", page.get_by_text("Fix 4 things to create your trip").is_visible())
            focused = page.evaluate("() => document.activeElement && document.activeElement.getAttribute('placeholder')")
            failures += not check(f"[{width}] focus moves to the title field", focused == "Bachelorette trip")

            # 2) Title
            page.get_by_label("Trip name").fill("Kyoto fall colors")

            # 3) Live city search with the keyboard: type, wait for results, Enter adds the top hit.
            city = page.get_by_role("combobox", name="Where are you going?")
            city.fill("Kyoto")
            option = page.get_by_role("option").filter(has_text="Japan").first
            option.wait_for(timeout=10000)
            failures += not check(f"[{width}] live results list Kyoto, Japan", "Kyoto" in option.inner_text())
            active = city.get_attribute("aria-activedescendant")
            failures += not check(f"[{width}] aria-activedescendant points at an option", bool(active))
            city.press("Enter")
            page.wait_for_timeout(200)
            chips = page.get_by_role("list", name="Your destinations, in order")
            failures += not check(f"[{width}] Kyoto chip added", "Kyoto" in chips.inner_text())

            # Second stop with the mouse.
            city.fill("Osaka")
            osaka = page.get_by_role("option").filter(has_text="Osaka").first
            osaka.wait_for(timeout=10000)
            osaka.click()
            page.wait_for_timeout(200)
            failures += not check(f"[{width}] Osaka chip added", "Osaka" in chips.inner_text())

            # Escape closes the list.
            city.fill("Nar")
            page.wait_for_timeout(900)
            city.press("Escape")
            failures += not check(f"[{width}] Escape closes the results", city.get_attribute("aria-expanded") == "false")
            city.fill("")

            # 4) Dates
            page.get_by_label("Start date").fill(start.isoformat())
            page.get_by_label("End date").fill(end.isoformat())
            failures += not check(f"[{width}] trip length shows 6 days", page.get_by_text("6 days").first.is_visible())

            # 5) Invite: a bad email is rejected, a good one is added as a Viewer.
            page.get_by_label("Name", exact=True).fill("Kenji Watanabe")
            page.get_by_label("Email", exact=True).fill("kenji@")
            page.get_by_role("button", name="Add", exact=True).click()
            failures += not check(f"[{width}] invalid email message", page.locator(".field-error").filter(has_text="Enter an email like name@example.com").first.is_visible())
            page.get_by_label("Email", exact=True).fill("kenji.watanabe@example.com")
            page.get_by_role("button", name="Add", exact=True).click()
            people = page.get_by_role("list", name="People on this trip")
            failures += not check(f"[{width}] invitee listed", "Kenji Watanabe" in people.inner_text() and "Viewer" in people.inner_text())

            # 6) The cover photo for Kyoto appears in the preview (bundled photo → instant).
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / f"p06-e2e-form-{width}.png"), full_page=True)

            # 7) Save → Page 5 with the new trip highlighted.
            page.get_by_role("button", name="Create trip").click()
            page.wait_for_url("**/#/trips", timeout=8000)
            page.wait_for_timeout(700)
            failures += not check(f"[{width}] landed on My trips", page.evaluate("location.hash") == "#/trips")
            failures += not check(f"[{width}] 'Trip created' banner", page.locator(".p05-created").get_by_text("Trip created", exact=True).is_visible())
            card = page.locator("article.trip-card.is-highlight")
            failures += not check(f"[{width}] new trip card is highlighted", card.count() == 1 and "Kyoto fall colors" in card.inner_text())
            failures += not check(f"[{width}] card lists both stops", "Kyoto · Osaka" in card.inner_text())
            card.scroll_into_view_if_needed()
            page.screenshot(path=str(OUT / f"p06-e2e-trips-{width}.png"))

            # 8) The highlight clears after leaving and coming back.
            page.get_by_role("link", name="Add your first event").click()
            page.wait_for_timeout(500)
            page.goto(f"{BASE}#/trips", wait_until="networkidle")
            page.wait_for_timeout(400)
            failures += not check(f"[{width}] banner shows once", page.locator(".p05-created").count() == 0)

            for e in errors:
                failures += 1
                print(f"  ! {e}")
            ctx.close()
        browser.close()
    print("ALL PASS" if failures == 0 else f"{failures} FAILURE(S)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
