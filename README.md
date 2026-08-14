# The Brick Luxury Properties

Static luxury real estate website for [www.thebrick.realestate](https://www.thebrick.realestate).

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| **Modulo 1** | ✅ | Static site — home, about, team, contact, property catalogue |
| **Modulo 2** | ✅ | CRM sync — automated feed → `properties.json` / `off-market.json` |
| **Modulo 3** | ✅ | Off-Market area — lead form, access code, noindex |

## Local preview

```bash
python3 -m http.server 8090
```

Open [http://localhost:8090](http://localhost:8090).

Off-Market area: [http://localhost:8090/off-market/](http://localhost:8090/off-market/) (not linked from public nav).

## Modulo 2 — CRM sync

Property data flows from your CRM into the site via `scripts/sync_crm.py`.

### Source

- **Production:** set GitHub secrets `CRM_FEED_URL` (+ optional `CRM_FEED_TOKEN`)
- **Local / demo:** edit `data/crm-source.json` and run:

```bash
python3 scripts/sync_crm.py
```

### Output files

| File | Contents |
|------|----------|
| `data/properties.json` | Public active listings |
| `data/off-market.json` | Off-market active listings |
| `data/sold.json` | Sold / rented (removed from public catalogue) |
| `data/sync-meta.json` | Last sync timestamp and counts |

### CRM field mapping

| CRM field | Site field |
|-----------|------------|
| `status`: active / sold / rented | Controls visibility |
| `visibility`: public / off_market | Public vs off-market catalogue |
| `title`, `location`, `price`, `images` | Listing details |
| `featured` | Home page carousel |

Sold or rented properties are **automatically removed** from the public and off-market catalogues.

### Automation

- **`.github/workflows/sync-crm.yml`** — runs every 6 hours + manual trigger + `repository_dispatch` event `crm-updated`
- On change, commits updated JSON to `main` → triggers deploy

To trigger from your CRM:

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/thebrick/dispatches \
  -d '{"event_type":"crm-updated"}'
```

## Modulo 3 — Off-Market area

- URL: `/off-market/` — **not in navigation**, `noindex`, blocked in `robots.txt`
- **Step 1:** Lead profiling form (name, budget, timeline, interest)
- **Step 2:** Access code (SHA-256 verified client-side, session 24h)
- Separate catalogue from `data/off-market.json`

### Configuration (`data/off-market-config.json`)

| Key | Description |
|-----|-------------|
| `accessHash` | SHA-256 hash of access code |
| `sessionHours` | Session duration (default 24) |
| `leadWebhookUrl` | Optional POST endpoint for lead JSON |

Generate access hash:

```bash
python3 -c "import hashlib; print(hashlib.sha256(b'YOUR-CODE').hexdigest())"
```

Set production secrets in GitHub:

- `OFF_MARKET_ACCESS_HASH` — injected at deploy
- `LEAD_WEBHOOK_URL` — Zapier, Make, n8n, or custom endpoint

## Deploy

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`.

### Custom domain

`CNAME` → `www.thebrick.realestate`. DNS:

| Type  | Name | Value                    |
|-------|------|--------------------------|
| CNAME | www  | `<your-username>.github.io` |

Also configure the custom domain under **Settings → Pages**.
