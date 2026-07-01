# The Brick Luxury Properties

Coming soon landing page for [www.thebrick.realestate](https://www.thebrick.realestate).

## Local preview

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Deploy

Pushes to `main` deploy automatically to GitHub Pages via GitHub Actions.

### Custom domain

The `CNAME` file points to `www.thebrick.realestate`. In your DNS provider, add:

| Type  | Name | Value                    |
|-------|------|--------------------------|
| CNAME | www  | `<your-username>.github.io` |

Also add the custom domain in the repository **Settings → Pages**.
