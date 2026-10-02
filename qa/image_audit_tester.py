"""
Image audit for a tester-created trip (live data): create a Kyoto trip with a
live-searched event, then check Ideas, Map (food layer), Itinerary, Day, Trips,
and Home for any image slot without a real or representative photo.

Usage: python3 qa/image_audit_tester.py [--base URL] [--width 1440]
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys

from playwright.sync_api import sync_playwright

AUDIT_JS = """async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
      for (let y = 0; y < el.scrollHeight; y += 500) { el.scrollTop = y; await new Promise(r => setTimeout(r, 100)); }
    }
  }
  await new Promise(r => setTimeout(r, 4000));
  const slots = [...document.querySelectorAll('.place-photo')];
  // A slot's picture: the <img> itself, or the <img> inside a tagged representative frame.
  const pic = (e) => e.tagName === 'IMG' ? e : e.querySelector('img');
  const imgs = slots.map(pic).filter(Boolean);
  return {
    slots: slots.length,
    real: slots.filter(e => !e.classList.contains('is-representative') && pic(e) && pic(e).naturalWidth > 0).length,
    representative: slots.filter(e => e.classList.contains('is-representative') && pic(e) && pic(e).naturalWidth > 0).map(e => e.title),
    pending: slots.filter(e => !pic(e)).map(e => e.getAttribute('aria-label')),
    broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.alt + ' <' + (i.currentSrc || i.src).slice(0, 90) + '>'),
    icons: document.querySelectorAll('.place-photo-fallback').length,
  };
}"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5188/travel-planner-prototype/")
    ap.add_argument("--width", type=int, default=1440)
    args = ap.parse_args()
    base = args.base
    start = dt.date.today() + dt.timedelta(days=40)
    problems = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": args.width, "height": 900 if args.width > 800 else 844})
        page = ctx.new_page()
        page.goto(f"{base}#/trips/new?auth=new", wait_until="networkidle")
        page.get_by_label("Trip name").fill("Kyoto fall colors")
        city = page.get_by_role("combobox", name="Where are you going?")
        city.fill("Kyoto")
        page.get_by_role("option").filter(has_text="Japan").first.wait_for(timeout=15000)
        city.press("Enter")
        page.get_by_label("Start date").fill(start.isoformat())
        page.get_by_label("End date").fill((start + dt.timedelta(days=3)).isoformat())
        page.get_by_role("button", name="Create trip").first.click()
        page.wait_for_url(re.compile(r"#/trips"), timeout=15000)
        page.get_by_role("link", name="Add your first event").first.click()
        where = page.get_by_role("combobox", name="Where")
        where.fill("Kinkaku")
        page.get_by_role("option").filter(has_text="Kinkaku").first.wait_for(timeout=15000)
        where.press("Enter")
        page.get_by_label("Starts").fill("10:00")
        page.wait_for_timeout(2500)
        page.locator("button.p07-save").click()
        page.wait_for_url(re.compile(r"#/trip/[^/?]+\?focus="), timeout=15000)
        trip_id = page.evaluate("() => location.hash").split("/trip/")[1].split("?")[0]
        routes = {
            "itinerary": f"/trip/{trip_id}",
            "ideas": f"/trip/{trip_id}/ideas",
            "day": f"/trip/{trip_id}/day/{start.isoformat()}",
            "map-food": f"/trip/{trip_id}/map?layers=trip,ideas,food",
            "trips": "/trips",
            "home": "/home",
        }
        for name, route in routes.items():
            page.goto(f"{base}#{route}", wait_until="networkidle")
            page.wait_for_timeout(3000 if name != "ideas" else 9000)
            r = page.evaluate(AUDIT_JS)
            bad = r["pending"] or r["broken"] or r["icons"]
            problems += bool(bad)
            print(f"{name:<10} slots={r['slots']:>3} real={r['real']:>3} representative={len(r['representative']):>3} pending={len(r['pending'])} broken={len(r['broken'])} icons={r['icons']}")
            for x in r["broken"][:5]:
                print("     broken:", x)
            for x in r["pending"][:5]:
                print("     pending:", x)
        b.close()
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
