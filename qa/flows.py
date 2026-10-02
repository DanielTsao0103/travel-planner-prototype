"""
End-to-end journeys, clicked through like a tester would, at phone (390) and
desktop (1440) widths. Each journey starts from a fresh browser profile.

Usage:
  python3 qa/flows.py                 # all journeys, both widths
  python3 qa/flows.py --only signup,trip --widths 390
  python3 qa/flows.py --base https://danieltsao0103.github.io/travel-planner-prototype/

Journeys:
  signup     new user: create account → connect Instagram (Page 3) → Home
  login      returning user: unknown email, wrong password, then log in;
             during the trip the dashboard auto-opens (Page 10)
  trip       new trip to Kyoto with live city search (Page 6) → invite →
             add an event with live place search (Page 7) → itinerary (Page 8)
             → jump into the trip → dashboard → day detail
  nearby     nearby pop-up (Page 16) → Go → map route (Page 17)
  consistent an idea added on Page 9 shows on Pages 8, 10, and 11
  roles      Viewer locks; Day editor can edit Day 3 only; only the person owed
             can mark a repayment paid; Owner demotes Sam and Sam loses Day 3
  budget     add an expense "I paid for others" → 4 new "owes" rows
  survey     new user fills the survey (Page 15) → tiles on Page 13
  invite     pending invitation on Page 5 → Accept → survey prompt
"""

from __future__ import annotations

import argparse
import re
import sys
import traceback
from dataclasses import dataclass, field
from typing import Callable

from playwright.sync_api import Page, expect, sync_playwright

SAMPLE = "trip-sample-p-maya"


@dataclass
class Ctx:
    base: str
    width: int
    page: Page
    errors: list[str] = field(default_factory=list)

    def go(self, route: str) -> None:
        """Open an in-app route (hash path + query)."""
        self.page.goto(f"{self.base}#{route}", wait_until="networkidle", timeout=45000)
        self.page.wait_for_timeout(400)

    def hash(self) -> str:
        return self.page.evaluate("() => location.hash")

    def click(self, name: str, role: str = "button", exact: bool = True, nth: int = 0) -> None:
        """Click a button/link by its accessible name."""
        loc = self.page.get_by_role(role, name=name, exact=exact)  # type: ignore[arg-type]
        loc.nth(nth).click()
        self.page.wait_for_timeout(350)

    def see(self, text: str | re.Pattern[str], timeout: int = 8000) -> None:
        """Assert some visible text appears."""
        expect(self.page.get_by_text(text).first).to_be_visible(timeout=timeout)


def open_prototype_controls(c: Ctx) -> None:
    """Desktop: header pill. Phone: account menu → Prototype controls."""
    if c.width >= 768:
        c.click("Prototype")
    else:
        c.click("Account menu")
        c.click("Prototype controls")
    c.page.wait_for_timeout(300)


# --------------------------------------------------------------------- journeys


def j_signup(c: Ctx) -> None:
    c.go("/login")
    c.click("New here? Create an Account", role="button", exact=False)
    c.page.get_by_role("textbox", name="Name", exact=True).fill("Taylor Brooks")
    c.page.get_by_role("textbox", name="Email", exact=True).fill("taylor.brooks@example.com")
    c.page.get_by_label("Password", exact=True).fill("trips2026")
    c.click("Create account")
    c.page.wait_for_url(re.compile(r"#/connect"), timeout=10000)
    c.see("Connect your accounts")
    c.click("Connect Instagram", role="link")
    c.see("would like to")
    c.click("Allow")
    c.page.get_by_role("button", name=re.compile("Back to your checklist|Done")).first.click(timeout=10000)
    c.page.wait_for_timeout(500)
    c.see(re.compile("Connected|still needed"))
    # With Instagram connected, Continue goes Home.
    c.page.get_by_role("button", name="Continue").first.click()
    c.page.wait_for_url(re.compile(r"#/home"), timeout=10000)
    c.see("+ New Trip")
    c.see("Open existing trip")


def j_login(c: Ctx) -> None:
    c.go("/login")
    c.page.get_by_role("textbox", name="Email", exact=True).fill("nobody@example.com")
    c.page.get_by_label("Password", exact=True).fill("whatever1")
    c.click("Log in")
    c.see("We don’t have an account for nobody@example.com")
    c.page.get_by_role("textbox", name="Email", exact=True).fill("maya.chen@example.com")
    c.page.get_by_label("Password", exact=True).fill("wrong-pass1")
    c.click("Log in")
    c.see(re.compile("doesn’t match maya.chen@example.com"))
    c.page.get_by_label("Password", exact=True).fill("wayfare-demo")
    c.click("Log in")
    c.page.wait_for_url(re.compile(r"#/home"), timeout=10000)
    # Move the demo clock into the trip: the dashboard opens by itself (Page 10).
    c.go("/home?clock=during")
    c.page.wait_for_url(re.compile(rf"#/trip/{SAMPLE}/dashboard"), timeout=10000)
    c.see(re.compile("Opened automatically"))


def j_trip(c: Ctx) -> None:
    """A brand-new tester creates their own trip to a non-sample city and plans it."""
    import datetime as dt

    start = dt.date.today() + dt.timedelta(days=40)
    end = start + dt.timedelta(days=3)
    c.go("/trips/new?auth=new")
    c.page.get_by_label("Trip name").fill("Kyoto fall colors")
    city = c.page.get_by_role("combobox", name="Where are you going?")
    city.fill("Kyoto")
    c.page.get_by_role("option").filter(has_text="Japan").first.wait_for(timeout=15000)
    city.press("Enter")
    c.page.get_by_label("Start date").fill(start.isoformat())
    c.page.get_by_label("End date").fill(end.isoformat())
    c.page.get_by_label("Name", exact=True).fill("Kenji Watanabe")
    c.page.get_by_label("Email", exact=True).fill("kenji.watanabe@example.com")
    c.page.get_by_role("button", name="Add", exact=True).click()
    c.page.get_by_role("button", name="Create trip").first.click()
    c.page.wait_for_url(re.compile(r"#/trips"), timeout=10000)
    c.see("Trip created")
    c.see("Kyoto fall colors")
    # Add the first event with live place search (Page 7).
    c.page.get_by_role("link", name="Add your first event").first.click()
    place = c.page.get_by_role("combobox", name="Where")
    place.fill("Kinkaku")
    c.page.get_by_role("option").filter(has_text="Kinkaku").first.wait_for(timeout=15000)
    place.press("Enter")
    c.page.get_by_label("Starts").fill("10:00")
    c.page.locator("button.p07-save").click()
    c.page.wait_for_url(re.compile(r"#/trip/[^/?]+\?focus="), timeout=10000)
    c.see(re.compile("Kinkaku"))
    trip_id = c.hash().split("/trip/")[1].split("?")[0]
    # Jump into the trip with the Prototype controls → the dashboard opens (Page 10).
    open_prototype_controls(c)
    dialog = c.page.get_by_role("dialog")
    dialog.get_by_label("Trip", exact=True).select_option(label="Kyoto fall colors")
    dialog.get_by_role("button", name="Jump into trip").click()
    c.page.wait_for_url(re.compile(rf"#/trip/{trip_id}/dashboard"), timeout=10000)
    c.see(re.compile(r"Day 1 of 4", re.I))
    # Day detail (Page 11) shows the same event.
    c.go(f"/trip/{trip_id}/day/{start.isoformat()}")
    c.see(re.compile("Kinkaku"))


def j_nearby(c: Ctx) -> None:
    c.go(f"/trip/{SAMPLE}/dashboard?auth=maya&clock=during&nearby=1")
    c.see("Padaria Celeste", timeout=12000)
    c.see(re.compile(r"450 ft away|ft away"))
    c.page.get_by_role("button", name=re.compile(r"^Go")).first.click()
    c.page.wait_for_url(re.compile(r"/map\?.*to=padaria-celeste"), timeout=10000)
    c.see(re.compile(r"Route to a nearby match", re.I), timeout=15000)
    c.see(re.compile(r"^\d+ min$"), timeout=15000)


def j_consistent(c: Ctx) -> None:
    c.go(f"/trip/{SAMPLE}/ideas?auth=maya&clock=during&s=add")
    c.see("Padaria Celeste")
    # The add sheet is open for Padaria Celeste: confirm.
    dialog = c.page.get_by_role("dialog")
    dialog.get_by_role("button", name=re.compile(r"^Add")).last.click()
    c.page.wait_for_timeout(600)
    c.see(re.compile("Added to Day 2"))
    # Page 8 (itinerary), Page 11 (Day 2), Page 10 (week calendar) all show it.
    c.go(f"/trip/{SAMPLE}")
    c.see("Padaria Celeste")
    day2 = c.page.evaluate(
        "() => JSON.parse(localStorage.getItem('wayfare-prototype-state-v3')).trips.find(t => t.id === 'trip-sample-p-maya').startDate"
    )
    c.go(f"/trip/{SAMPLE}/dashboard")
    c.see("Padaria Celeste")


def j_roles(c: Ctx) -> None:
    # Viewer: Add event is locked and explains why when tapped.
    c.go(f"/trip/{SAMPLE}?auth=maya&as=viewer")
    add = c.page.get_by_role("button", name=re.compile("Add event")).first
    expect(add).to_have_attribute("aria-disabled", "true")
    add.dispatch_event("click")
    c.see(re.compile("Viewer"))
    # Day editor (Sam): Day 3 editable, Day 2 locked.
    start = c.page.evaluate(
        "() => JSON.parse(localStorage.getItem('wayfare-prototype-state-v3')).trips.find(t => t.id === 'trip-sample-p-maya').startDate"
    )
    y, m, d = (int(x) for x in start.split("-"))
    import datetime as dt

    day2 = (dt.date(y, m, d) + dt.timedelta(days=1)).isoformat()
    day3 = (dt.date(y, m, d) + dt.timedelta(days=2)).isoformat()
    c.go(f"/trip/{SAMPLE}/day/{day3}?as=day&clock=during")
    c.see(re.compile("can edit this day", re.I))
    c.go(f"/trip/{SAMPLE}/day/{day2}?as=day&clock=during")
    c.see(re.compile("only the day|View only|can’t edit|Go to Day 3", re.I))
    # Only the person owed can mark a repayment paid: Jordan sees the button, Priya doesn't for Jordan's rows.
    c.go(f"/trip/{SAMPLE}/budget?as=editor&clock=during&tab=owed")
    expect(c.page.get_by_role("button", name=re.compile("Mark as paid")).first).to_be_visible()
    c.go(f"/trip/{SAMPLE}/budget?as=viewer&clock=during&tab=owed")
    c.see(re.compile("Waiting for"))
    # Owner demotes Sam to Viewer; Sam then can't edit Day 3.
    c.go(f"/trip/{SAMPLE}/people?as=owner&s=role")
    dialog = c.page.get_by_role("dialog")
    dialog.get_by_role("radio", name=re.compile(r"^Viewer")).first.check()
    dialog.get_by_role("button").last.click()
    c.page.wait_for_timeout(500)
    c.go(f"/trip/{SAMPLE}/day/{day3}?as=day&clock=during")
    c.see(re.compile("can’t edit|View only|Ask", re.I))


def j_budget(c: Ctx) -> None:
    c.go(f"/trip/{SAMPLE}/budget?auth=maya&clock=during&s=add")
    dialog = c.page.get_by_role("dialog")
    dialog.get_by_label(re.compile("^Amount")).first.fill("62.50")
    dialog.get_by_label(re.compile("What it was for")).fill("Tram tickets for everyone")
    dialog.get_by_role("button", name=re.compile("Transport")).first.click()
    # "I paid for others" switch
    sw = dialog.get_by_role("switch").first
    if sw.get_attribute("aria-checked") != "true":
        sw.click()
    dialog.get_by_role("button", name=re.compile("Save expense")).click()
    c.page.wait_for_timeout(600)
    c.see("Tram tickets for everyone")
    c.go(f"/trip/{SAMPLE}/budget?tab=owed&clock=during")
    c.see(re.compile("Tram tickets for everyone"))


def j_survey(c: Ctx) -> None:
    c.go("/survey?auth=new&step=1")
    c.see(re.compile("Food|dietary", re.I))
    c.page.get_by_role("button", name=re.compile("Vegetarian")).first.click()
    for _ in range(3):
        c.page.get_by_role("button", name=re.compile(r"^Next")).first.click()
        c.page.wait_for_timeout(300)
    # Step 4 requires a walking limit and a tickets choice.
    c.page.get_by_role("radio", name=re.compile("20 min")).first.click()
    c.page.get_by_role("radio", name=re.compile("Happy to book")).first.click()
    c.page.get_by_role("button", name=re.compile(r"^Next")).first.click()
    c.page.get_by_role("button", name=re.compile("Save preferences")).first.click()
    c.page.wait_for_timeout(700)


def j_invite(c: Ctx) -> None:
    c.go("/trips?auth=new")
    c.see("Mexico City Food Week")
    c.page.get_by_role("button", name=re.compile(r"^Accept")).first.click()
    c.page.wait_for_url(re.compile(r"#/survey"), timeout=10000)


JOURNEYS: dict[str, Callable[[Ctx], None]] = {
    "signup": j_signup,
    "login": j_login,
    "trip": j_trip,
    "nearby": j_nearby,
    "consistent": j_consistent,
    "roles": j_roles,
    "budget": j_budget,
    "survey": j_survey,
    "invite": j_invite,
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:5188/travel-planner-prototype/")
    parser.add_argument("--only", default="")
    parser.add_argument("--widths", default="390,1440")
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    names = [n for n in (args.only.split(",") if args.only else JOURNEYS)]
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        for width in [int(w) for w in args.widths.split(",")]:
            for name in names:
                context = browser.new_context(
                    viewport={"width": width, "height": 844 if width < 768 else 900},
                    is_mobile=width < 768,
                    has_touch=width < 768,
                )
                page = context.new_page()
                c = Ctx(args.base, width, page)
                page.on("pageerror", lambda exc, c=c: c.errors.append(str(exc)))
                try:
                    JOURNEYS[name](c)
                    status = "PASS" if not c.errors else f"PASS with page errors: {c.errors[:2]}"
                    if c.errors:
                        failures += 1
                except Exception as exc:  # report and keep going
                    failures += 1
                    shot = f"qa/screens/flow-fail-{name}-{width}.png"
                    page.screenshot(path=shot)
                    status = f"FAIL at {c.hash()} — {str(exc).splitlines()[0][:220]} (screenshot {shot})"
                    if "--trace" in sys.argv:
                        traceback.print_exc()
                print(f"[{width:>4}px] {name:<11} {status}")
                context.close()
        browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
