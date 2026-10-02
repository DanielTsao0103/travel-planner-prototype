"""
Image audit: find every place where a photo is expected but missing.

For each Screen Index state (desktop width), counts:
  - illustrated fallback tiles (.place-photo-fallback), with the place they stand in for
  - <img> elements that failed to load (naturalWidth 0 after load)
Also scrolls the page so lazy images get a chance to load.

Usage:
  python3 qa/image_audit.py                 # every screen
  python3 qa/image_audit.py --only 9A,9I    # some screens
  python3 qa/image_audit.py --route "/trip/trip-zion/ideas?auth=maya"
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:5188/travel-planner-prototype/"

AUDIT_JS = """async () => {
  // Scroll through the page (and any scrollable panels) so lazy images load.
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY.match(/auto|scroll/)) {
      for (let y = 0; y < el.scrollHeight; y += 500) { el.scrollTop = y; await new Promise(r => setTimeout(r, 80)); }
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  // Icon tiles (old fallback) or loaders still spinning count as missing.
  const fallbacks = [...document.querySelectorAll('.place-photo-fallback, .place-photo.skeleton')].map(e => e.getAttribute('aria-label') || e.className);
  const broken = [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => (i.alt || '') + ' <' + i.getAttribute('src').slice(0, 80) + '>');
  const total = document.querySelectorAll('img').length;
  return { fallbacks, broken, total };
}"""


def collect(page) -> list[dict[str, str]]:
    page.goto(f"{BASE}#/proto/index", wait_until="networkidle")
    page.wait_for_selector(".proto-row")
    return page.evaluate(
        """() => [...document.querySelectorAll('.proto-row')].map(r => ({
            id: r.querySelector('.proto-id').textContent.trim(),
            href: r.querySelector('a').getAttribute('href') }))"""
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--route", default="")
    ap.add_argument("--width", type=int, default=1440)
    args = ap.parse_args()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if args.route:
            screens = [{"id": "route", "href": "#" + args.route}]
        else:
            page = browser.new_page()
            screens = collect(page)
            page.close()
            if args.only:
                keep = set(args.only.split(","))
                screens = [s for s in screens if s["id"] in keep]
        for s in screens:
            ctx = browser.new_context(viewport={"width": args.width, "height": 900 if args.width > 800 else 844})
            page = ctx.new_page()
            try:
                page.goto(BASE + s["href"], wait_until="networkidle", timeout=45000)
            except Exception:
                pass
            page.wait_for_timeout(2500)
            r = page.evaluate(AUDIT_JS)
            r["id"] = s["id"]
            results.append(r)
            if r["fallbacks"] or r["broken"]:
                print(f"{s['id']:>5}: {len(r['fallbacks'])} fallback, {len(r['broken'])} broken (of {r['total']} imgs)")
                for f in r["fallbacks"][:12]:
                    print(f"         fallback: {f}")
                for b in r["broken"][:6]:
                    print(f"         broken:   {b}")
            ctx.close()
        browser.close()
    (ROOT / "report").mkdir(exist_ok=True)
    (ROOT / "report" / "image_audit.json").write_text(json.dumps(results, indent=2))
    missing = sum(len(r["fallbacks"]) + len(r["broken"]) for r in results)
    print(f"\n{len(results)} screens audited; {missing} missing images")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
