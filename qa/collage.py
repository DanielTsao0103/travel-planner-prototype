"""
Capture every Screen Index state (phone + desktop, full page) and build the
collage page at public/collage/index.html, so the whole prototype can be seen
in one place: the main journey in order, then every page's states.

Usage:
  python3 qa/collage.py                       # capture from the local dev server
  python3 qa/collage.py --base https://danieltsao0103.github.io/travel-planner-prototype/
  python3 qa/collage.py --html-only           # rebuild the page from existing shots

Output:
  public/collage/shots/<id>-phone.webp, <id>-desktop.webp
  public/collage/index.html   (deployed with the site at /collage/)
"""

from __future__ import annotations

import argparse
import io
import json
import multiprocessing as mp
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "collage"
SHOTS = OUT / "shots"

PAGE_NAMES = {
    1: "Log in & create an account",
    2: "Connect accounts",
    3: "Connection flow",
    4: "Home",
    5: "Existing trips",
    6: "Create & edit a trip",
    7: "Add an event",
    8: "Day-by-day itinerary",
    9: "Suggestions",
    10: "Active-trip dashboard",
    11: "Day detail",
    12: "Budget & reimbursements",
    13: "Collaborators, preferences & permissions",
    15: "Preferences survey",
    16: "Nearby suggestion pop-up",
    17: "Map",
}

# The main journey, in order (screen ids from the Screen Index).
JOURNEY = [
    ("1B", "Create an account"),
    ("2A", "Connect accounts"),
    ("3A", "Allow access (simulated)"),
    ("2B", "Checklist updated"),
    ("4B", "Home"),
    ("6C", "Create a trip + invite"),
    ("5D", "Trip created"),
    ("15A", "Preferences survey"),
    ("13A", "Group preferences"),
    ("7B", "Add an event"),
    ("8C", "Itinerary"),
    ("9A", "Ideas"),
    ("10B", "Trip dashboard opens"),
    ("11A", "Day detail"),
    ("12A", "Budget"),
    ("12G", "Who owes whom"),
    ("16A", "Nearby pop-up"),
    ("17B", "Route on the map"),
]

WIDTHS = {"phone": (390, 844, 2), "desktop": (1440, 900, 1)}
MAX_HEIGHT = {"phone": 3200, "desktop": 2600}  # CSS px; very long pages are cropped
SLOW = ("9H", "9I", "9J", "10", "11", "16", "17")  # live data / maps need more time
# Short-lived states (a spinner that finishes on its own): shoot right away, no scrolling.
INSTANT = {"1H", "3B", "6D", "7E"}

SCROLL_JS = """async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));
  return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
}"""


def collect(base: str) -> list[dict[str, str]]:
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto(f"{base}#/proto/index", wait_until="networkidle")
        page.wait_for_selector(".proto-row")
        rows = page.evaluate(
            """() => [...document.querySelectorAll('.proto-row')].map(r => ({
                id: r.querySelector('.proto-id').textContent.trim(),
                title: r.querySelector('.proto-title').childNodes[0].textContent.trim(),
                href: r.querySelector('a').getAttribute('href') }))"""
        )
        b.close()
    return rows


def capture(job: tuple[str, dict[str, str], str]) -> dict[str, object]:
    base, screen, kind = job
    width, height, dpr = WIDTHS[kind]
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr, is_mobile=kind == "phone", has_touch=kind == "phone")
        page = ctx.new_page()
        try:
            page.goto(base + screen["href"], wait_until="networkidle", timeout=45000)
        except Exception:
            pass
        if screen["id"] in INSTANT:
            page.wait_for_timeout(700)
            png = page.screenshot()
            b.close()
            img = Image.open(io.BytesIO(png)).convert("RGB")
            out = SHOTS / f"{screen['id']}-{kind}.webp"
            img.save(out, "WEBP", quality=72, method=5)
            return {"id": screen["id"], "kind": kind, "w": img.width, "h": img.height, "bytes": out.stat().st_size}
        page.wait_for_timeout(4500 if screen["id"].startswith(SLOW) else 2200)
        full = page.evaluate(SCROLL_JS)
        page.wait_for_timeout(600)
        # Grow the window to the page's height so fixed bars land at the real bottom
        # (map pages fill the screen, so they keep the normal window size).
        is_map = screen["id"].startswith("17") or screen["id"] in ("16A",)
        if not is_map and full > height:
            page.set_viewport_size({"width": width, "height": min(full, MAX_HEIGHT[kind])})
            page.wait_for_timeout(700)
        png = page.screenshot()
        b.close()
    img = Image.open(io.BytesIO(png)).convert("RGB")
    out = SHOTS / f"{screen['id']}-{kind}.webp"
    img.save(out, "WEBP", quality=72, method=5)
    return {"id": screen["id"], "kind": kind, "w": img.width, "h": img.height, "bytes": out.stat().st_size}


def page_number(screen_id: str) -> int:
    return int("".join(ch for ch in screen_id if ch.isdigit()))


def build_html(screens: list[dict[str, str]], sizes: dict[str, dict[str, list[int]]]) -> None:
    by_id = {s["id"]: s for s in screens}
    data = {
        "pages": [
            {
                "n": n,
                "name": name,
                "states": [
                    {"id": s["id"], "title": s["title"], "sizes": sizes.get(s["id"], {})}
                    for s in screens
                    if page_number(s["id"]) == n and sizes.get(s["id"])
                ],
            }
            for n, name in PAGE_NAMES.items()
        ],
        "journey": [{"id": i, "label": label, "title": by_id[i]["title"] if i in by_id else label} for i, label in JOURNEY if i in sizes],
    }
    template = (ROOT / "qa" / "collage_template.html").read_text()
    (OUT / "index.html").write_text(template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False)))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5188/travel-planner-prototype/")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--html-only", action="store_true")
    ap.add_argument("--only", default="", help="comma-separated screen ids to recapture")
    args = ap.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    screens = collect(args.base)
    if not args.html_only:
        keep = set(args.only.split(",")) if args.only else None
        jobs = [(args.base, s, k) for s in screens for k in WIDTHS if keep is None or s["id"] in keep]
        print(f"Capturing {len(jobs)} screenshots…")
        with mp.Pool(args.workers) as pool:
            for r in pool.imap_unordered(capture, jobs):
                print(f"  {r['id']:>4} {r['kind']:<7} {r['w']}x{r['h']} {int(r['bytes']) // 1024} KB")
    sizes: dict[str, dict[str, list[int]]] = {}
    for f in SHOTS.glob("*.webp"):
        sid, kind = f.stem.rsplit("-", 1)
        with Image.open(f) as im:
            sizes.setdefault(sid, {})[kind] = [im.width, im.height]
    build_html(screens, sizes)
    total = sum(f.stat().st_size for f in SHOTS.glob("*.webp"))
    print(f"\nWrote public/collage/index.html with {len(sizes)} screens ({total / 1e6:.1f} MB of images)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
