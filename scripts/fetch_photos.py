"""
Download openly licensed photos for the prototype's bundled sample data.

How it works (one photo per entry in PHOTOS):
  1. Ask English Wikipedia for the article's lead image ("pageimage").
  2. Look that file up on Wikimedia Commons to get its license + author.
  3. Keep it only if the license is free (CC BY / CC BY-SA / CC0 / public domain).
     If not, fall back to a Commons file search for the same subject.
  4. Download a 1280px rendition, then use macOS `sips` to make two JPEGs:
       public/img/<id>.jpg    (1000px wide, for heroes / detail views)
       public/img/<id>-t.jpg  (400px wide, for list thumbnails)
  5. Record title/author/license/source URL in src/data/photoCredits.json,
     which the in-app Credits page reads (CC BY-SA requires attribution).

Run:  python3 scripts/fetch_photos.py            (skips photos already downloaded)
      python3 scripts/fetch_photos.py --force    (re-downloads everything)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT: Path = Path(__file__).resolve().parent.parent
IMG_DIR: Path = ROOT / "public" / "img"
CREDITS_PATH: Path = ROOT / "src" / "data" / "photoCredits.json"

# Wikimedia asks every script to send a descriptive User-Agent.
USER_AGENT: str = (
    "TravelPlannerPrototype/0.1 "
    "(https://github.com/DanielTsao0103/travel-planner-prototype; student prototype)"
)

# id -> (Wikipedia article title, fallback Commons search query)
PHOTOS: dict[str, tuple[str, str]] = {
    # Home suggestions + login hero
    "kyoto": ("Fushimi Inari-taisha", "Fushimi Inari torii"),
    "mexico-city": ("Palacio de Bellas Artes", "Palacio de Bellas Artes Mexico City"),
    "iceland": ("Skógafoss", "Skogafoss waterfall"),
    # Trip covers
    "lisbon": ("Praça do Comércio", "Praca do Comercio Lisbon"),
    "porto": ("Dom Luís I Bridge", "Ribeira Porto Dom Luis bridge"),
    "kauai": ("", "Na Pali Coast Kauai cliffs aerial"),
    "banff": ("Moraine Lake", "Moraine Lake Banff"),
    "zion": ("Zion National Park", "Zion Canyon Virgin River"),
    # Lisbon / Sintra / Porto places
    "jeronimos": ("Jerónimos Monastery", "Jeronimos Monastery Lisbon"),
    "pasteis-belem": ("Pastel de nata", "Pasteis de Belem pastry"),
    "time-out-market": ("Mercado da Ribeira", "Time Out Market Lisboa"),
    "lx-factory": ("LX Factory", "LX Factory Lisbon"),
    "castelo": ("São Jorge Castle", "Castelo de Sao Jorge Lisbon"),
    "santa-luzia": ("Miradouro de Santa Luzia", "Miradouro de Santa Luzia Lisbon"),
    "pena": ("Pena Palace", "Pena Palace Sintra"),
    "regaleira": ("Quinta da Regaleira", "Quinta da Regaleira initiation well"),
    "rossio-station": ("Rossio railway station", "Estacao do Rossio Lisboa"),
    "tram-28": ("Trams in Lisbon", "Lisbon tram 28 Alfama"),
    "maat": ("", "MAAT Museum of Art Architecture Technology Lisbon exterior"),
    "belem-tower": ("Belém Tower", "Torre de Belem Lisbon"),
    "alfama": ("Alfama", "Alfama Lisbon street"),
    "fado": ("", "Fado singer guitar Lisbon concert"),
    "santa-justa": ("Santa Justa Lift", "Elevador de Santa Justa"),
    "lello": ("Livraria Lello", "Livraria Lello Porto"),
    "ribeira-porto": ("Ribeira (Porto)", "Cais da Ribeira Porto"),
    "sao-bento": ("São Bento railway station", "Sao Bento station azulejos"),
    "santa-apolonia": ("Santa Apolónia railway station", "Santa Apolonia station Lisbon"),
    "port-cellar": ("Port wine", "Port wine cellar barrels Gaia"),
    "francesinha": ("Francesinha", "Francesinha Porto"),
    "serralves": ("", "Casa de Serralves villa Porto"),
    "monserrate": ("Monserrate Palace", "Monserrate Palace Sintra"),
    "sao-pedro-alcantara": ("Miradouro de São Pedro de Alcântara", "Miradouro Sao Pedro de Alcantara"),
    "rabelo": ("Rabelo boat", "Rabelo boats Douro Porto"),
    "palacio-cristal": ("Jardins do Palácio de Cristal", "Jardins do Palacio de Cristal Porto"),
    "azulejo-museum": ("Museu Nacional do Azulejo", "Museu Nacional do Azulejo"),
    # Food / fictional restaurants (generic dishes and rooms only)
    "seafood": ("", "grilled sardines Portugal plate"),
    "veg-dish": ("Peixinhos da horta", "Peixinhos da horta"),
    "bakery": ("Bakery", "bakery display bread pastries"),
    "restaurant": ("Restaurant", "restaurant interior tables"),
    "wine-bar": ("Wine bar", "wine bar interior"),
    "sourdough": ("Sourdough", "sourdough bread loaves"),
    "caldo-verde": ("Caldo verde", "Caldo verde soup"),
    # Other trips
    "waimea": ("Waimea Canyon State Park", "Waimea Canyon Kauai"),
    "hanalei": ("Hanalei Bay", "Hanalei Bay Kauai"),
    "luau": ("", "hula dancers Hawaii luau show"),
    "central-park": ("Central Park", "Central Park Bethesda Terrace"),
    "the-met": ("Metropolitan Museum of Art", "Metropolitan Museum of Art facade"),
    "broadway": ("Broadway theatre", "Broadway theatre marquee"),
    "lake-louise": ("Lake Louise (Alberta)", "Lake Louise Alberta"),
    "banff-gondola": ("Banff Gondola", "Banff Gondola Sulphur Mountain"),
    "johnston-canyon": ("Johnston Canyon", "Johnston Canyon Banff"),
    "frida": ("Frida Kahlo Museum", "Casa Azul Frida Kahlo museum"),
    "teotihuacan": ("Teotihuacan", "Teotihuacan Pyramid of the Sun"),
    "coyoacan": ("Coyoacán", "Coyoacan Mexico City plaza"),
    "tacos": ("Taco", "tacos al pastor"),
}

FREE_LICENSE = re.compile(r"(cc[ -]?by|cc0|public domain|pd|attribution|gfdl)", re.I)


def get_json(url: str, params: dict[str, str]) -> dict[str, Any]:
    """GET a Wikimedia API URL with query params and return parsed JSON."""
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def strip_html(text: str) -> str:
    """Wikimedia's 'Artist' metadata is HTML; reduce it to plain text."""
    return re.sub(r"<[^>]+>", "", text or "").strip()


def lead_image_name(article: str) -> str | None:
    """Return the File: name of a Wikipedia article's lead image, if any."""
    data = get_json(
        "https://en.wikipedia.org/w/api.php",
        {"action": "query", "prop": "pageimages", "piprop": "name", "titles": article,
         "redirects": "1", "format": "json"},
    )
    for page in data.get("query", {}).get("pages", {}).values():
        if page.get("pageimage"):
            return str(page["pageimage"])
    return None


def commons_info(file_name: str) -> dict[str, Any] | None:
    """Look up a file on Commons: 1280px URL + license/author metadata."""
    data = get_json(
        "https://commons.wikimedia.org/w/api.php",
        {"action": "query", "titles": f"File:{file_name}", "prop": "imageinfo",
         "iiprop": "url|extmetadata|size|mime", "iiurlwidth": "1280", "format": "json"},
    )
    for page in data.get("query", {}).get("pages", {}).values():
        infos = page.get("imageinfo")
        if not infos:
            return None  # not on Commons (probably a non-free enwiki upload)
        info = infos[0]
        meta = info.get("extmetadata", {})
        return {
            "file": file_name,
            "mime": info.get("mime", ""),
            "width": info.get("width", 0),
            "thumb": info.get("thumburl") or info.get("url"),
            "page": info.get("descriptionurl", ""),
            "license": strip_html(meta.get("LicenseShortName", {}).get("value", "")),
            "licenseUrl": meta.get("LicenseUrl", {}).get("value", ""),
            "author": strip_html(meta.get("Artist", {}).get("value", ""))[:120],
        }
    return None


def search_commons(query: str) -> list[str]:
    """Search Commons for bitmap files matching a query; return File names."""
    data = get_json(
        "https://commons.wikimedia.org/w/api.php",
        {"action": "query", "list": "search", "srsearch": f"{query} filetype:bitmap",
         "srnamespace": "6", "srlimit": "8", "format": "json"},
    )
    hits = data.get("query", {}).get("search", [])
    return [h["title"].removeprefix("File:") for h in hits]


def usable(info: dict[str, Any] | None) -> bool:
    """A photo is usable if it's a free-licensed JPEG/PNG at least 800px wide."""
    return bool(
        info
        and info["mime"] in ("image/jpeg", "image/png")
        and info["width"] >= 800
        and FREE_LICENSE.search(info["license"] or "")
    )


def download(url: str, dest: Path) -> None:
    """Download a URL to a local file (with the polite User-Agent)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def resize(src: Path, dest: Path, width: int, quality: int) -> None:
    """Use macOS's built-in `sips` to resize + re-encode as JPEG."""
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality),
         "--resampleWidth", str(width), str(src), "--out", str(dest)],
        check=True, capture_output=True,
    )


def main() -> None:
    force = "--force" in sys.argv
    only: set[str] = set()
    for arg in sys.argv[1:]:
        if arg.startswith("--only="):
            only = set(arg.removeprefix("--only=").split(","))
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    credits: dict[str, Any] = {}
    if CREDITS_PATH.exists() and not force:
        credits = json.loads(CREDITS_PATH.read_text())

    for photo_id, (article, query) in PHOTOS.items():
        if only and photo_id not in only:
            continue
        if not only and not force and photo_id in credits and (IMG_DIR / f"{photo_id}.jpg").exists():
            continue
        try:
            info = None
            name = lead_image_name(article) if article else None
            if name:
                info = commons_info(name)
            if not usable(info):
                for candidate in search_commons(query):
                    info = commons_info(candidate)
                    if usable(info):
                        break
                    time.sleep(0.3)
            if not usable(info):
                print(f"[skip] {photo_id}: no free image found")
                continue
            assert info is not None
            raw = IMG_DIR / f"_{photo_id}.raw"
            download(info["thumb"], raw)
            resize(raw, IMG_DIR / f"{photo_id}.jpg", 1000, 72)
            resize(raw, IMG_DIR / f"{photo_id}-t.jpg", 400, 70)
            raw.unlink()
            credits[photo_id] = {
                "subject": article,
                "file": info["file"],
                "author": info["author"] or "Unknown",
                "license": info["license"],
                "licenseUrl": info["licenseUrl"],
                "source": info["page"],
            }
            print(f"[ok]   {photo_id}: {info['file']} ({info['license']})")
        except Exception as exc:  # keep going; report at the end
            print(f"[err]  {photo_id}: {exc}")
        time.sleep(0.5)  # be polite to Wikimedia

    CREDITS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDITS_PATH.write_text(json.dumps(credits, indent=2, ensure_ascii=False) + "\n")
    print(f"\n{len(credits)} photos credited -> {CREDITS_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
