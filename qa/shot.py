"""
Screenshot one app route at phone and desktop widths and report problems.

Usage:
  python3 qa/shot.py "/trip/trip-sample-p-maya?auth=maya&date=during" --name p08-itinerary
  python3 qa/shot.py "/login" --widths 390 --full

Each run uses a fresh browser profile, so the app starts from its seed data
(use the `auth=` / `as=` / `date=` URL params to set up a state).

Prints, per width:
  - console errors / page errors
  - horizontal overflow (document wider than the viewport)
and saves PNGs to qa/screens/<name>-<width>.png.

Options:
  --base URL     app base (default http://127.0.0.1:5188/travel-planner-prototype/)
  --widths A,B   viewport widths (default 390,1440)
  --full         full-page screenshot (default: just the first screen)
  --wait MS      extra wait after load (default 900)
  --click TEXT   click the first button/link with this exact accessible name before the shot (repeatable)
  --dark         emulate dark color scheme
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screens"
HEIGHTS = {390: 844, 768: 1024, 1440: 900}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("route")
    parser.add_argument("--name", default="shot")
    parser.add_argument("--base", default="http://127.0.0.1:5188/travel-planner-prototype/")
    parser.add_argument("--widths", default="390,1440")
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--wait", type=int, default=900)
    parser.add_argument("--click", action="append", default=[])
    parser.add_argument("--dark", action="store_true")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    route = args.route if args.route.startswith("/") else "/" + args.route
    url = f"{args.base}#{route}"
    problems = 0

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in [int(w) for w in args.widths.split(",")]:
            context = browser.new_context(
                viewport={"width": width, "height": HEIGHTS.get(width, 900)},
                device_scale_factor=1 if width > 800 else 2,
                is_mobile=width < 768,
                has_touch=width < 768,
                color_scheme="dark" if args.dark else "light",
            )
            page = context.new_page()
            errors: list[str] = []
            page.on("console", lambda m, e=errors: e.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda exc, e=errors: e.append(f"pageerror: {exc}"))
            page.goto(url, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(args.wait)
            for name in args.click:
                page.get_by_role("button", name=name, exact=True).or_(page.get_by_role("link", name=name, exact=True)).first.click()
                page.wait_for_timeout(700)
            overflow = page.evaluate(
                "() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
            )
            path = OUT / f"{args.name}-{width}.png"
            page.screenshot(path=str(path), full_page=args.full)
            final_hash = page.evaluate("() => location.hash")
            print(f"[{width}px] {path.relative_to(ROOT.parent)}  (now at {final_hash})")
            if overflow["sw"] > overflow["cw"]:
                problems += 1
                print(f"  ! horizontal overflow: scrollWidth {overflow['sw']} > {overflow['cw']}")
            # Ignore noisy third-party network errors (tiles, live services) — they have fallbacks.
            real = [e for e in errors if "Failed to load resource" not in e]
            for e in real:
                problems += 1
                print(f"  ! {e}")
            context.close()
        browser.close()
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
