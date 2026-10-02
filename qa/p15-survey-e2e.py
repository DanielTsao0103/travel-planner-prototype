"""
End-to-end check for Page 15 -> Page 13: a brand-new user fills in the
preferences survey, saves it, and their answers show up in the group tiles
on THEIR copy of the sample trip (trip-sample-<their person id>).

Usage:
  python3 qa/p15-survey-e2e.py                 # phone (390) and desktop (1440)
  python3 qa/p15-survey-e2e.py --widths 1440

What it does, per width (fresh browser profile each time):
  1. Opens /survey?auth=new so the app creates a demo account (Alex Rivera).
  2. Reads Alex's person id from the saved app state and opens Alex's sample
     trip People page: expects "4 of 5 travelers" and an "Add your preferences" nudge.
  3. Clicks "Add my preferences" (so the survey knows the trip + return path).
  4. Answers all 5 steps, including tripping the step-4 validation once.
  5. Saves, then checks Page 13 shows the saved state and Alex's answers:
     5 of 5 travelers, Vegan + severe Peanuts rows, the new 5-minute walking
     limit, a cane/walker access need, highlights, and "Shared preferences".
Screenshots: qa/screens/p15-e2e-<width>.png (full page, final state).
Exit code 1 if any check fails.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screens"
BASE = "http://127.0.0.1:5188/travel-planner-prototype/"
STATE_KEY = "wayfare-prototype-state-v3"
HEIGHTS = {390: 844, 1440: 900}


class Checker:
    """Collects PASS/FAIL lines so one failure doesn't hide the others."""

    def __init__(self, width: int) -> None:
        self.width = width
        self.failures = 0

    def check(self, label: str, fn) -> None:
        try:
            fn()
            print(f"  PASS  {label}")
        except Exception as exc:  # noqa: BLE001 - report and keep going
            self.failures += 1
            lines = [l.strip() for l in str(exc).strip().splitlines() if l.strip()] or [repr(exc)]
            detail = next((l for l in lines if "strict mode" in l), lines[0])
            print(f"  FAIL  {label}: {detail}")


def next_button(page: Page):
    """Phone says "Next"; desktop says "Next: <step name>"."""
    return page.get_by_role("button", name=re.compile(r"^Next")).first


def person_id(page: Page) -> str:
    """The signed-in person's id, read from the app's saved state."""
    page.wait_for_timeout(400)  # the store saves to localStorage after a short debounce
    raw = page.evaluate(f"() => window.localStorage.getItem('{STATE_KEY}')")
    state = json.loads(raw)
    account = next(a for a in state["accounts"] if a["id"] == state["sessionAccountId"])
    return account["personId"]


def run(width: int) -> int:
    print(f"\n[{width}px]")
    c = Checker(width)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": width, "height": HEIGHTS.get(width, 900)},
            device_scale_factor=1 if width > 800 else 2,
            is_mobile=width < 768,
            has_touch=width < 768,
        )
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.on("console", lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)

        # 1. Brand-new account.
        page.goto(f"{BASE}#/survey?auth=new&step=1", wait_until="networkidle")
        page.wait_for_timeout(600)
        pid = person_id(page)
        trip_id = f"trip-sample-{pid}"
        print(f"  new person {pid}, sample trip {trip_id}")

        # 2. Their sample trip's People page before answering.
        page.goto(f"{BASE}#/trip/{trip_id}/people", wait_until="networkidle")
        page.wait_for_timeout(500)
        c.check("before: 4 of 5 travelers shared preferences", lambda: expect(page.get_by_text("4 of 5 travelers")).to_be_visible())
        c.check("before: nudge to add my preferences", lambda: expect(page.get_by_text("The tiles below don’t include you yet.")).to_be_visible())

        # 3. Open the survey from the page (carries trip + return).
        page.get_by_role("link", name="Add my preferences").first.click()
        page.wait_for_timeout(500)
        c.check("survey opened with trip context", lambda: expect(page).to_have_url(re.compile(rf"/survey\?.*trip={re.escape(trip_id)}")))
        c.check("new-user title", lambda: expect(page.get_by_role("heading", name="Tell your group what works for you")).to_be_visible())

        # Step 1: Next with nothing picked shows the error, then pick Vegan + Peanuts.
        next_button(page).click()
        c.check("step 1 validation error", lambda: expect(page.get_by_text("Pick the diets or allergies that apply to you")).to_be_visible())
        page.get_by_role("button", name="Vegan", exact=True).click()
        page.get_by_role("button", name="Peanuts", exact=True).click()
        c.check("peanuts severity defaults to Severe", lambda: expect(page.get_by_role("radio", name="Severe")).to_have_attribute("aria-checked", "true"))
        next_button(page).click()

        # Step 2: dining style.
        page.wait_for_timeout(250)
        c.check("on step 2", lambda: expect(page.get_by_text("Step 2 of 5", exact=False).first).to_be_visible())
        page.get_by_role("radio", name="Mostly familiar").click()
        page.get_by_role("radio", name="Some splurges").click()
        page.get_by_role("radio", name="$60+ per person").click()
        page.get_by_role("button", name="Romantic", exact=True).click()
        next_button(page).click()

        # Step 3: interests.
        page.wait_for_timeout(250)
        page.get_by_role("button", name="Modern", exact=True).click()
        page.get_by_role("button", name="Beaches", exact=True).click()
        next_button(page).click()

        # Step 4: trip the validation, then answer.
        page.wait_for_timeout(250)
        next_button(page).click()
        c.check("step 4 walking error", lambda: expect(page.get_by_text("Choose how long you can comfortably walk at one time.")).to_be_visible())
        c.check("step 4 tickets error", lambda: expect(page.get_by_text("Choose how you feel about places that need tickets.")).to_be_visible())
        page.get_by_text("Cane or walker", exact=True).click()
        page.get_by_role("radio", name="5 min").click()
        page.get_by_text("I’d like help booking", exact=True).click()
        page.get_by_label("Anything else planners should know?").fill("Needs a bench every few blocks.")
        next_button(page).click()

        # Step 5: review and save.
        page.wait_for_timeout(250)
        c.check("review lists Vegan", lambda: expect(page.locator(".p15-review-item", has_text="Diet").first).to_contain_text("Vegan"))
        c.check("review lists peanuts (severe)", lambda: expect(page.locator(".p15-review-item", has_text="Allergies").first).to_contain_text("Peanuts (severe)"))
        page.get_by_role("button", name="Save preferences").click()
        page.wait_for_timeout(1500)

        # 5. Back on Page 13 in the saved state, with Alex's answers in the tiles.
        c.check("returned to the trip's People page (s=saved)", lambda: expect(page).to_have_url(re.compile(rf"/trip/{re.escape(trip_id)}/people\?s=saved")))
        c.check("saved banner", lambda: expect(page.get_by_text("Your preferences were saved.")).to_be_visible())
        c.check("now 5 of 5 travelers", lambda: expect(page.get_by_text("5 of 5 travelers")).to_be_visible())
        c.check("diet tile: Vegan · You", lambda: expect(page.locator(".p13-diet", has_text="Vegan")).to_contain_text("You"))
        c.check("diet tile: Peanuts severe allergy", lambda: expect(page.locator(".p13-diet", has_text="Peanuts")).to_contain_text("Severe allergy"))
        c.check("diet summary includes peanut-free", lambda: expect(page.locator(".p13-tile-summary", has_text="peanut-free").first).to_be_visible())
        c.check("walking limit is now 5 min", lambda: expect(page.locator(".p13-tile-summary", has_text="5 min at a time")).to_be_visible())
        c.check("access tile lists the cane/walker need", lambda: expect(page.get_by_text("Uses a cane or walker")).to_be_visible())
        c.check("other needs note appears", lambda: expect(page.get_by_text("Needs a bench every few blocks.")).to_be_visible())
        c.check("your answers are highlighted", lambda: expect(page.locator(".p13-hl").first).to_be_visible())
        c.check("collaborators: Alex shares preferences", lambda: expect(page.locator(".p13-member", has_text="Alex Rivera")).to_contain_text("Shared preferences"))

        # Editing again: the survey prefills (15H).
        page.get_by_role("link", name="Update my preferences").first.click()
        page.wait_for_timeout(500)
        c.check("edit mode title", lambda: expect(page.get_by_role("heading", name="Update your preferences")).to_be_visible())
        c.check("edit mode keeps Vegan", lambda: expect(page.get_by_role("button", name="Vegan", exact=True)).to_have_attribute("aria-pressed", "true"))

        # Final screenshot of the saved People page.
        page.go_back()
        page.wait_for_timeout(800)
        OUT.mkdir(parents=True, exist_ok=True)
        shot = OUT / f"p15-e2e-{width}.png"
        page.screenshot(path=str(shot), full_page=True)
        print(f"  screenshot {shot.relative_to(ROOT.parent)}")

        for e in errors:
            c.failures += 1
            print(f"  FAIL  {e}")
        context.close()
        browser.close()
    print(f"  {'OK' if c.failures == 0 else f'{c.failures} failure(s)'}")
    return c.failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--widths", default="390,1440")
    args = parser.parse_args()
    failures = sum(run(int(w)) for w in args.widths.split(","))
    print("\nALL PASSED" if failures == 0 else f"\n{failures} FAILURE(S)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
