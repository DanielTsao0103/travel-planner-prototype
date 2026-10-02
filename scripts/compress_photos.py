"""
Re-encode the downloaded photos with Pillow so the site stays light.

macOS `sips` ignores numeric JPEG quality on some inputs, so photos came out
up to ~650 KB. Pillow's progressive + optimized JPEG at q≈72 typically lands
at 90-180 KB for a 1000px photo with no visible loss at UI sizes.

Run:  python3 scripts/compress_photos.py
"""

from pathlib import Path

from PIL import Image

IMG_DIR: Path = Path(__file__).resolve().parent.parent / "public" / "img"


def compress(path: Path, quality: int) -> tuple[int, int]:
    """Re-save one JPEG in place; return (bytes_before, bytes_after)."""
    before = path.stat().st_size
    with Image.open(path) as img:
        rgb = img.convert("RGB")  # drop alpha/CMYK so JPEG encoding is predictable
        rgb.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    return before, path.stat().st_size


def main() -> None:
    total_before = total_after = 0
    for path in sorted(IMG_DIR.glob("*.jpg")):
        quality = 68 if path.stem.endswith("-t") else 72  # thumbnails can go lower
        b, a = compress(path, quality)
        total_before += b
        total_after += a
    print(f"{total_before/1e6:.1f} MB -> {total_after/1e6:.1f} MB")


if __name__ == "__main__":
    main()
