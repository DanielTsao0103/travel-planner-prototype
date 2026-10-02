"""
Tile sweep screenshots into contact-sheet images for quick visual review.
Each row: phone (390) + desktop (1440) for one screen id.

Usage: python3 qa/contact.py [--ids 8A,8B] [--per 6] [--prefix sheet]
Output: qa/report/<prefix>-NN.png
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--per", type=int, default=6)
    ap.add_argument("--prefix", default="sheet")
    args = ap.parse_args()
    results = json.loads((ROOT / "report" / "sweep.json").read_text())
    order: list[str] = []
    for r in results:
        if r["id"] not in order:
            order.append(r["id"])
    if args.ids:
        wanted = args.ids.split(",")
        order = [i for i in order if i in wanted]
    phone_w, desk_w = 200, 640  # thumbnail widths
    row_h = 440
    for n in range(0, len(order), args.per):
        chunk = order[n : n + args.per]
        sheet = Image.new("RGB", (phone_w + desk_w + 30, row_h * len(chunk)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, sid in enumerate(chunk):
            y = i * row_h
            for w, x, tw in ((390, 0, phone_w), (1440, phone_w + 20, desk_w)):
                p = ROOT / "screens" / "sweep" / f"{sid}-{w}.png"
                if not p.exists():
                    continue
                im = Image.open(p).convert("RGB")
                im.thumbnail((tw, row_h - 24))
                sheet.paste(im, (x, y + 20))
            draw.text((4, y + 4), sid, fill="red")
        out = ROOT / "report" / f"{args.prefix}-{n // args.per:02d}.png"
        sheet.save(out)
        print(out.relative_to(ROOT.parent), chunk)


if __name__ == "__main__":
    main()
