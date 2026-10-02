"""
Page 7 end-to-end checks (add / edit / view an event).

  1. Validation: Save with no place focuses the place search.
  2. Manual add on the sample trip: pick a place, time → crowd estimate; overlap → "Save anyway";
     save → itinerary with ?focus= and a toast.
  3. Sample confirmation: read → review chips → fill gaps → save (source: screenshot).
  4. Your own image: simulated partial read → fill the place → save.
  5. Tiny image → "couldn't read" → "Enter details yourself" switches tabs.
  6. Edit e4 + delete e5 with Undo.
  7. Viewer: event is view-only.
  8. A tester's own city: create a Kyoto trip, then add an event with LIVE place search.

Usage: python3 qa/p07-e2e.py     (screenshots → qa/screens/p07-e2e-*.png)
"""

from __future__ import annotations

import datetime as dt
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import Page, sync_playwright

BASE = "http://127.0.0.1:5188/travel-planner-prototype/"
OUT = Path(__file__).resolve().parent / "screens"
TRIP = "trip-sample-p-maya"
failures = 0


def check(label: str, ok: bool) -> None:
    global failures
    print(f"{'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        failures += 1


def make_images(folder: Path) -> tuple[Path, Path]:
    """A phone-sized 'screenshot' and a tiny unreadable icon."""
    big = folder / "booking.png"
    img = Image.new("RGB", (750, 1500), (245, 245, 245))
    d = ImageDraw.Draw(img)
    d.rectangle((40, 120, 710, 700), outline=(30, 30, 30), width=4)
    d.text((70, 150), "Reservation confirmed", fill=(20, 20, 20))
    img.save(big)
    tiny = folder / "icon.png"
    Image.new("RGB", (40, 40), (200, 50, 50)).save(tiny)
    return big, tiny


def goto(page: Page, route: str) -> None:
    page.goto(f"{BASE}#{route}", wait_until="networkidle")
    page.wait_for_timeout(500)


def events_count(page: Page) -> int:
    return page.evaluate("() => JSON.parse(localStorage.getItem('wayfare-prototype-state-v3') || '{\"events\":[]}').events.length")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    big, tiny = make_images(tmp)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(1440, 900), (390, 844)]:
            ctx = browser.new_context(viewport={"width": width, "height": height}, is_mobile=width < 768, has_touch=width < 768)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
            tag = f"[{width}]"

            # ---------------------------------------------------- 1) validation
            goto(page, f"/trip/{TRIP}/event/new?auth=maya")
            save = page.locator("button.p07-save")
            save.click()
            page.wait_for_timeout(300)
            focused_role = page.evaluate("() => document.activeElement && document.activeElement.getAttribute('role')")
            check(f"{tag} empty save focuses the place search", focused_role == "combobox")
            check(f"{tag} place error shown", page.get_by_text("Choose a place from the list").is_visible())

            # ------------------------------------- 2) manual add + crowd + conflict
            place = page.get_by_role("combobox", name="Where")
            place.fill("Belém Tower")
            opt = page.locator(".p07-combo-option").filter(has_text="Belém Tower").first
            opt.wait_for(timeout=10000)
            place.press("Enter")
            page.wait_for_timeout(200)
            check(f"{tag} place card shows Belém Tower", page.locator(".p07-place-name").inner_text() == "Belém Tower")
            page.locator(".p07-cell-day select").select_option(index=1)  # Day 2
            page.get_by_label("Starts").fill("15:30")
            page.wait_for_timeout(200)
            check(f"{tag} end defaults to +1 hour", page.get_by_label("Ends").input_value() == "16:30")
            busy = page.locator(".p07-busy:not(.is-empty)").first
            check(f"{tag} crowd estimate appears", busy.count() == 1 and "at 3:30 PM" in busy.inner_text())
            check(f"{tag} crowd card says Estimate", "Estimate" in busy.inner_text())
            check(f"{tag} overlap warning names Santa Justa Lift", page.get_by_text("Overlaps with Santa Justa Lift (3:30–4:15 PM)").is_visible())
            check(f"{tag} button reads Save anyway", save.inner_text().strip() == "Save anyway")
            # Move it so it no longer overlaps.
            page.get_by_label("Starts").fill("17:00")
            page.wait_for_timeout(200)
            check(f"{tag} button reads Add to Day 2", save.inner_text().strip() == "Add to Day 2")
            page.get_by_label("Amount in US dollars").fill("9")
            check(f"{tag} cost hint multiplies per person", "$9.00 × 5 people = $45.00 total." in page.locator(".p07-cost + .field-hint").inner_text())
            before = events_count(page)
            save.click()
            page.wait_for_url("**/#/trip/" + TRIP + "?focus=*", timeout=6000)
            page.wait_for_timeout(500)
            check(f"{tag} saved → itinerary with ?focus=", "focus=" in page.evaluate("location.hash"))
            check(f"{tag} toast 'Added to Day 2'", page.get_by_text("Added to Day 2").first.is_visible())
            check(f"{tag} one event added", events_count(page) == before + 1)

            # --------------------------------------------- 3) sample confirmation
            goto(page, f"/trip/{TRIP}/event/new?tab=upload")
            page.get_by_role("button", name="Use a sample confirmation").click()
            check(f"{tag} reading state shows", page.get_by_text("Reading your screenshot…").is_visible())
            page.get_by_text("Check what we found").wait_for(timeout=8000)
            check(f"{tag} review: place found", page.locator(".p07-place-name").inner_text() == "National Tile Museum")
            check(f"{tag} review: end needs input", page.locator(".p07-src.is-needed").count() == 2)
            page.screenshot(path=str(OUT / f"p07-e2e-review-{width}.png"))
            page.locator("button.p07-save").click()
            page.wait_for_timeout(300)
            check(f"{tag} review: missing end blocks saving", page.get_by_text("Pick an end time").is_visible())
            page.get_by_role("button", name="2 hr").click()
            page.get_by_role("button", name="Select everyone").click()
            page.wait_for_timeout(200)
            check(f"{tag} review: chips turn to 'Added by you'", page.locator(".p07-src.is-added").count() == 2)
            page.locator("button.p07-save").click()
            page.wait_for_url("**/#/trip/" + TRIP + "?focus=*", timeout=6000)
            page.wait_for_timeout(400)  # the store saves to localStorage after a short delay
            src = page.evaluate("() => { const s = JSON.parse(localStorage.getItem('wayfare-prototype-state-v3')); return s.events[s.events.length - 1]; }")
            ok = src.get("source") == "screenshot" and src.get("confirmation") == "MNAZ-22871" and (src.get("cost") or {}).get("amount") == 8
            check(f"{tag} saved from screenshot (source, code, cost)", ok)
            if not ok:
                print("   got:", {k: src.get(k) for k in ("source", "confirmation", "cost", "date", "start", "end")})

            # ------------------------------------------------ 4) your own image
            goto(page, f"/trip/{TRIP}/event/new?tab=upload")
            page.locator("input[type=file]").set_input_files(str(big))
            page.get_by_text("Check what we found").wait_for(timeout=8000)
            check(f"{tag} own image: 'Simulated reading' banner", page.get_by_text("Simulated reading").is_visible())
            check(f"{tag} own image: start 7:00 PM found", page.get_by_label("Starts").input_value() == "19:00")
            where = page.get_by_role("combobox", name="Where")
            where.fill("Tia Rosa dinner party")
            custom = page.locator(".p07-combo-option.is-custom")
            custom.wait_for(timeout=10000)
            custom.click()
            page.get_by_role("button", name="1½ hr").click()
            page.get_by_role("button", name="Select everyone").click()
            page.locator("button.p07-save").click()
            page.wait_for_url("**/#/trip/" + TRIP + "?focus=*", timeout=6000)
            check(f"{tag} own image: saved", "focus=" in page.evaluate("location.hash"))

            # ------------------------------------------------ 5) unreadable image
            goto(page, f"/trip/{TRIP}/event/new?tab=upload")
            page.locator("input[type=file]").set_input_files(str(tiny))
            page.get_by_text("We couldn’t read this image.").wait_for(timeout=8000)
            check(f"{tag} tiny image → couldn't read", True)
            page.get_by_role("button", name="Enter details yourself").click()
            check(f"{tag} 'Enter details yourself' → details tab", page.get_by_role("tab", name="Enter details").get_attribute("aria-selected") == "true")

            # ------------------------------------------------ 6) edit + delete/undo
            goto(page, f"/trip/{TRIP}/event/{TRIP}-e4")
            check(f"{tag} edit prefilled (Jerónimos 9:30)", page.get_by_label("Starts").input_value() == "09:30")
            page.get_by_label("Starts").fill("10:00")
            page.locator("button.p07-save").click()
            page.wait_for_url("**/#/trip/" + TRIP + "?focus=*", timeout=6000)
            check(f"{tag} edit saved (toast)", page.get_by_text("Changes saved").first.is_visible())
            goto(page, f"/trip/{TRIP}/event/{TRIP}-e5")
            count = events_count(page)
            page.get_by_role("button", name="Delete event").click()
            page.get_by_role("group", name="Confirm delete").get_by_role("button", name="Delete event").click()
            page.wait_for_timeout(400)
            check(f"{tag} deleted → back on itinerary", page.evaluate("location.hash") == f"#/trip/{TRIP}")
            page.wait_for_timeout(200)
            check(f"{tag} event removed", events_count(page) == count - 1)
            page.get_by_role("button", name="Undo").click()
            page.wait_for_timeout(300)
            check(f"{tag} Undo restores it", events_count(page) == count)

            # ------------------------------------------------------- 7) viewer
            goto(page, f"/trip/{TRIP}/event/{TRIP}-e4?as=viewer")
            check(f"{tag} viewer sees 'View only'", page.get_by_text("View only", exact=True).is_visible())
            check(f"{tag} viewer has no Save button", page.locator("button.p07-save").count() == 0)
            goto(page, f"/trip/{TRIP}/event/new?as=owner")

            # --------------------------- 8) tester's own city with live place search
            start = (dt.date.today() + dt.timedelta(days=20)).isoformat()
            end = (dt.date.today() + dt.timedelta(days=23)).isoformat()
            goto(page, "/trips/new")
            page.get_by_label("Trip name").fill("Kyoto test")
            city = page.get_by_role("combobox", name="Where are you going?")
            city.fill("Kyoto")
            page.get_by_role("option").filter(has_text="Japan").first.wait_for(timeout=10000)
            city.press("Enter")
            page.get_by_label("Start date").fill(start)
            page.get_by_label("End date").fill(end)
            page.get_by_role("button", name="Create trip").click()
            page.wait_for_url("**/#/trips", timeout=6000)
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / f"p07-e2e-trips-{width}.png"))
            next_step = page.get_by_role("link", name="Add your first event")
            check(f"{tag} Kyoto trip: next-step banner", next_step.count() == 1)
            if next_step.count() == 0:
                print("   links:", [l.inner_text()[:40] for l in page.get_by_role("link").all()][:12])
                continue
            next_step.click()
            page.wait_for_timeout(600)
            where = page.get_by_role("combobox", name="Where")
            check(f"{tag} Kyoto trip: search says 'in Kyoto'", where.get_attribute("placeholder") == "Search places in Kyoto")
            where.fill("Kinkaku")
            live = page.locator(".p07-combo-option").filter(has_text="Kinkaku").first
            live.wait_for(timeout=12000)
            check(f"{tag} live result for Kinkaku-ji", "Kinkaku" in live.inner_text())
            live.click()
            page.wait_for_timeout(2500)  # Wikipedia photo lookup
            photo_src = page.locator(".p07-place img").first.get_attribute("src") if page.locator(".p07-place img").count() else None
            check(f"{tag} live place got a photo", bool(photo_src) and "wikimedia" in (photo_src or ""))
            page.get_by_label("Starts").fill("10:00")
            page.wait_for_timeout(200)
            check(f"{tag} crowd estimate for the live place", page.locator(".p07-busy:not(.is-empty)").count() >= 1)
            page.screenshot(path=str(OUT / f"p07-e2e-kyoto-{width}.png"))
            page.locator("button.p07-save").click()
            page.wait_for_url("**/#/trip/*?focus=*", timeout=6000)
            check(f"{tag} Kyoto event saved", "focus=" in page.evaluate("location.hash"))

            for e in errors:
                check(f"{tag} console: {e}", False)
            ctx.close()
        browser.close()
    print("ALL PASS" if failures == 0 else f"{failures} FAILURE(S)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
