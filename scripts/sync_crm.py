#!/usr/bin/env python3
"""
Modulo 2 — CRM sync for The Brick Luxury Properties.

Fetches property data from a CRM feed URL or local file, then writes:
  - data/properties.json      (public, active listings)
  - data/off-market.json      (off-market, active listings)
  - data/sold.json            (sold / rented archive, optional public page)

Environment:
  CRM_FEED_URL   — HTTP(S) URL returning JSON (optional; falls back to data/crm-source.json)
  CRM_FEED_TOKEN — Bearer token for authenticated CRM APIs (optional)
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "preview" / "data"


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "property"


def format_price(price: int | float, currency: str = "CHF") -> str:
    if not price or price <= 0:
        return "Price on request"
    whole = int(round(price))
    formatted = f"{whole:,}".replace(",", "'")
    return f"{currency} {formatted}"


def normalize_status(raw: str | None) -> str:
    if not raw:
        return "active"
    key = raw.lower().strip()
    mapping = {
        "active": "active",
        "published": "active",
        "available": "active",
        "for_sale": "active",
        "for_sale_active": "active",
        "sold": "sold",
        "venduto": "sold",
        "rented": "rented",
        "affittato": "rented",
        "let": "rented",
        "archived": "sold",
        "withdrawn": "sold",
    }
    return mapping.get(key, "active")


def normalize_visibility(raw: str | None, off_market_flag: bool = False) -> str:
    if off_market_flag:
        return "off_market"
    if not raw:
        return "public"
    key = raw.lower().strip()
    if key in ("off_market", "off-market", "private", "confidential"):
        return "off_market"
    return "public"


def normalize_contract(raw: str | None) -> str:
    if not raw:
        return "sale"
    key = raw.lower().strip()
    if key in ("rent", "rental", "affitto", "lease"):
        return "rent"
    return "sale"


def normalize_type(raw: str | None) -> str:
    if not raw:
        return "villa"
    key = raw.lower().strip()
    mapping = {
        "villa": "villa",
        "house": "villa",
        "penthouse": "penthouse",
        "attico": "penthouse",
        "apartment": "apartment",
        "appartamento": "apartment",
        "flat": "apartment",
    }
    return mapping.get(key, key.replace(" ", "-"))


def crm_record_to_property(record: dict) -> dict:
    """Map a CRM record to the site property schema."""
    crm_id = str(record.get("crmId") or record.get("id") or record.get("externalId") or "")
    title = record.get("title") or record.get("name") or "Luxury property"
    prop_id = record.get("slug") or record.get("siteId") or slugify(f"{title}-{crm_id}")

    price = record.get("price")
    if price is None:
        price = record.get("priceAmount", 0)
    try:
        price = float(price)
    except (TypeError, ValueError):
        price = 0

    currency = record.get("currency") or "CHF"
    images = record.get("images") or record.get("photos") or []
    if isinstance(images, str):
        images = [images]
    image = record.get("image") or record.get("coverImage") or (images[0] if images else "assets/hero.jpg")

    # Keep asset paths relative when local; pass through absolute URLs from CRM
    def fix_image(src: str) -> str:
        if not src:
            return "assets/hero.jpg"
        if src.startswith("http://") or src.startswith("https://"):
            return src
        return src.lstrip("/")

    image = fix_image(image)
    images = [fix_image(i) for i in images] or [image]

    status = normalize_status(record.get("status"))
    visibility = normalize_visibility(
        record.get("visibility"),
        bool(record.get("offMarket") or record.get("off_market")),
    )

    features = record.get("features") or {}
    if not isinstance(features, dict):
        features = {}

    rooms = str(record.get("rooms") or features.get("Rooms") or "")
    area = str(record.get("area") or record.get("livingArea") or features.get("Living area") or "")

    property_obj = {
        "id": prop_id,
        "crmId": crm_id,
        "title": title,
        "location": record.get("location") or record.get("city") or "Ticino",
        "type": normalize_type(record.get("type") or record.get("propertyType")),
        "contract": normalize_contract(record.get("contract") or record.get("transactionType")),
        "status": status,
        "visibility": visibility,
        "price": int(price) if price else 0,
        "priceLabel": record.get("priceLabel") or format_price(price, currency),
        "rooms": rooms,
        "area": area,
        "image": image,
        "images": images,
        "featured": bool(record.get("featured", False)),
        "description": record.get("description") or "",
        "features": features,
        "updatedAt": record.get("updatedAt") or record.get("modifiedAt") or "",
    }

    if status == "sold":
        property_obj["statusLabel"] = record.get("statusLabel") or "Sold"
    elif status == "rented":
        property_obj["statusLabel"] = record.get("statusLabel") or "Rented"

    return property_obj


def load_crm_feed() -> list[dict]:
    url = os.environ.get("CRM_FEED_URL", "").strip()
    token = os.environ.get("CRM_FEED_TOKEN", "").strip()

    if url:
        headers = {"Accept": "application/json", "User-Agent": "TheBrick-CRM-Sync/1.0"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    else:
        source_path = DATA / "crm-source.json"
        if not source_path.exists():
            # fallback: repo-root data during migration
            source_path = ROOT / "data" / "crm-source.json"
        if not source_path.exists():
            print(f"No CRM_FEED_URL and no {source_path}", file=sys.stderr)
            sys.exit(1)
        payload = json.loads(source_path.read_text(encoding="utf-8"))

    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("properties") or payload.get("items") or payload.get("data") or []
    raise ValueError("CRM feed must be a JSON array or object with a properties array")


def split_properties(records: list[dict]) -> tuple[list, list, list]:
    public, off_market, sold = [], [], []

    for record in records:
        prop = crm_record_to_property(record)
        status = prop["status"]
        visibility = prop["visibility"]

        if status in ("sold", "rented"):
            sold.append(prop)
            continue

        if visibility == "off_market":
            prop["offMarket"] = True
            off_market.append(prop)
            continue

        public.append(prop)

    return public, off_market, sold


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    records = load_crm_feed()
    public, off_market, sold = split_properties(records)

    write_json(DATA / "properties.json", public)
    write_json(DATA / "off-market.json", off_market)
    write_json(DATA / "sold.json", sold)

    meta = {
        "syncedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "counts": {
            "public": len(public),
            "offMarket": len(off_market),
            "sold": len(sold),
            "total": len(records),
        },
    }
    write_json(DATA / "sync-meta.json", meta)

    print(
        f"Synced {len(records)} CRM records → "
        f"{len(public)} public, {len(off_market)} off-market, {len(sold)} sold/rented"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
