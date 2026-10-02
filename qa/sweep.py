"""
QA sweep: open every screen/state from the in-app Screen Index at phone and
desktop widths, then report console errors, horizontal overflow, and save
screenshots + an HTML contact sheet for visual review.

Usage:
  python3 qa/sweep.py                       # local dev server
  python3 qa/sweep.py --base https://danieltsao0103.github.io/travel-planner-prototype/
  python3 qa/sweep.py --only 8A,12C         # just some screens
  python3 qa/sweep.py --workers 4

Outputs:
  qa/screens/sweep/<id>-<width>.png
  qa/report/sweep.json   (machine-readable results)
  qa/report/index.html   (contact sheet: phone + desktop side by side)
"""

from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import sys
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screens" / "sweep"
REPORT = ROOT / "report"
WIDTHS = {390: 844, 1440: 900}
# Third-party network noise (map tiles, live open-data services) has in-app fallbacks.
IGNORED = ("Failed to load resource", "net::ERR_", "tile.openstreetmap.org")


def collect_screens(base: str) -> list[dict[str, str]]:
    """Read every screen row (id, title, href) from the Screen Index page."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{base}#/proto/index", wait_until="networkidle")
        page.wait_for_selector(".proto-row")
        rows = page.evaluate(
            """() => Array.from(document.querySelectorAll('.proto-row')).map(r => ({
                id: r.querySelector('.proto-id')?.textContent?.trim() ?? '',
                title: r.querySelector('.proto-title')?.childNodes[0]?.textContent?.trim() ?? '',
                href: r.querySelector('a')?.getAttribute('href') ?? '',
            }))"""
        )
        browser.close()
    return [r for r in rows if r["id"] and r["href"]]


def check_one(job: tuple[str, dict[str, str], int]) -> dict[str, Any]:
    """Open one screen at one width in a fresh browser profile and inspect it."""
    base, screen, width = job
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": width, "height": WIDTHS[width]},
            device_scale_factor=1,
            is_mobile=width < 768,
            has_touch=width < 768,
        )
        page = context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        url = base + screen["href"]
        started = time.time()
        try:
            page.goto(url, wait_until="networkidle", timeout=45000)
        except Exception as exc:  # slow live services shouldn't stop the sweep
            errors.append(f"goto: {exc}")
        page.wait_for_timeout(1600)
        metrics = page.evaluate(
            """() => {
                const de = document.documentElement;
                // Find the widest offending element to make overflow bugs easy to fix.
                let culprit = '';
                if (de.scrollWidth > de.clientWidth) {
                  let worst = 0;
                  for (const el of document.querySelectorAll('body *')) {
                    const r = el.getBoundingClientRect();
                    if (r.right > de.clientWidth + 1 && r.width > 0) {
                      const over = r.right - de.clientWidth;
                      if (over > worst) { worst = over; culprit = el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0,2).join('.'); }
                    }
                  }
                }
                return { sw: de.scrollWidth, cw: de.clientWidth, hash: location.hash, culprit,
                         title: document.title, text: (document.querySelector('main') || document.body).innerText.slice(0, 160) };
            }"""
        )
        shot = SHOTS / f"{screen['id']}-{width}.png"
        page.screenshot(path=str(shot))
        context.close()
        browser.close()
    real_errors = [e for e in errors if not any(s in e for s in IGNORED)]
    return {
        "id": screen["id"],
        "title": screen["title"],
        "width": width,
        "url": url,
        "final_hash": metrics["hash"],
        "overflow": metrics["sw"] > metrics["cw"],
        "overflow_px": metrics["sw"] - metrics["cw"],
        "culprit": metrics["culprit"],
        "errors": real_errors,
        "seconds": round(time.time() - started, 1),
        "shot": str(shot.relative_to(ROOT)),
    }


def write_contact_sheet(results: list[dict[str, Any]]) -> None:
    """HTML page with phone + desktop screenshots for each screen, problems highlighted."""
    by_id: dict[str, dict[int, dict[str, Any]]] = {}
    order: list[str] = []
    for r in results:
        if r["id"] not in by_id:
            order.append(r["id"])
        by_id.setdefault(r["id"], {})[r["width"]] = r
    rows = []
    for sid in order:
        cells = by_id[sid]
        title = next(iter(cells.values()))["title"]
        probs = []
        for w, r in sorted(cells.items()):
            if r["overflow"]:
                probs.append(f"{w}px overflow +{r['overflow_px']}px ({r['culprit']})")
            probs += [f"{w}px: {e[:160]}" for e in r["errors"]]
        status = "bad" if probs else "ok"
        imgs = "".join(
            f'<figure class="w{w}"><img loading="lazy" src="../{cells[w]["shot"]}"><figcaption>{w}px</figcaption></figure>'
            for w in sorted(cells)
        )
        prob_html = "".join(f"<li>{p}</li>" for p in probs)
        rows.append(f'<section class="{status}"><h2>{sid} · {title}</h2><ul>{prob_html}</ul><div class="pair">{imgs}</div></section>')
    html = f"""<!doctype html><meta charset="utf-8"><title>QA sweep</title>
<style>body{{font:14px system-ui;margin:24px;background:#f3f5f4;color:#14202b}}section{{margin:0 0 28px;padding:12px;background:#fff;border-radius:12px;border:1px solid #dbe2e0}}
section.bad{{border-color:#b8372a}}h2{{font-size:16px;margin:0 0 8px}}ul{{color:#b8372a;margin:0 0 8px}}.pair{{display:flex;gap:16px;align-items:flex-start}}
figure{{margin:0}}.w390 img{{width:260px}}.w1440 img{{width:720px}}img{{border:1px solid #dbe2e0;border-radius:8px}}figcaption{{color:#5c6873}}</style>
<h1>QA sweep — {len(order)} screens</h1>{''.join(rows)}"""
    (REPORT / "index.html").write_text(html)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:5188/travel-planner-prototype/")
    parser.add_argument("--only", default="")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    SHOTS.mkdir(parents=True, exist_ok=True)
    REPORT.mkdir(parents=True, exist_ok=True)
    screens = collect_screens(args.base)
    if args.only:
        keep = set(args.only.split(","))
        screens = [s for s in screens if s["id"] in keep]
    jobs = [(args.base, s, w) for s in screens for w in WIDTHS]
    print(f"{len(screens)} screens × {len(WIDTHS)} widths = {len(jobs)} checks")

    with mp.Pool(args.workers) as pool:
        results = []
        for r in pool.imap(check_one, jobs):
            flag = "OVERFLOW " if r["overflow"] else ""
            flag += f"{len(r['errors'])} errors" if r["errors"] else ""
            print(f"{r['id']:>4} {r['width']:>4}px {r['seconds']:>5}s {flag}")
            results.append(r)

    (REPORT / "sweep.json").write_text(json.dumps(results, indent=2))
    write_contact_sheet(results)
    bad = [r for r in results if r["overflow"] or r["errors"]]
    print(f"\n{len(results) - len(bad)}/{len(results)} clean. Report: qa/report/index.html")
    for r in bad:
        print(f"  {r['id']} @{r['width']}: overflow={r['overflow']} {r['culprit']} errors={r['errors'][:2]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
