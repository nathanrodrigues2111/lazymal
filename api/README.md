# LazyMAL API

A minimal, **Cloudflare Workers** stand-in for the [Jikan API](https://github.com/jikan-me/jikan) (which is being discontinued). It returns the same **Jikan-v4 JSON shape** LazyMAL already consumes, so it's a drop-in replacement.

## Two backends

| Source | Key needed | How | Used for |
| --- | --- | --- | --- |
| **scrape** (default) | ❌ | Parses MyAnimeList's public HTML with `HTMLRewriter` — same idea as Jikan | Browse endpoints |
| **official** (opt-in) | ✅ Client ID | MyAnimeList's official API v2 | Search, details, top-anime + faster browse |

Scraping is the resilient default (no key, survives even if official API access is revoked). Add `?source=official` to force the official API on browse endpoints.

## Endpoints

A pragmatic, extensible subset of Jikan (all list endpoints take `?page=N` and return `{ data, pagination }`):

```
GET /seasons/now                 scrape | official
GET /seasons/{year}/{season}     scrape | official   (season ∈ winter|spring|summer|fall)
GET /top/manga                   scrape | official
GET /top/anime                   official
GET /anime?q=…                   official   (search)
GET /manga?q=…                   official   (search)
GET /anime/{id}[/full]           official   (details → { data })
GET /manga/{id}[/full]           official   (details → { data })
```

New endpoints are easy to add: write a mapper in `src/official.ts` and/or a parser in `src/scrape.ts` against the shared `MalItem` shape in `src/shape.ts`, then route it in `src/index.ts`.

## Develop

```bash
cd api
npm install
npm run dev        # wrangler dev — serves at http://localhost:8787
npm run typecheck
```

Try it: `curl http://localhost:8787/seasons/now`

## Deploy

```bash
npm run deploy     # wrangler deploy
```

To enable the official-API endpoints, create a Client ID at
<https://myanimelist.net/apiconfig> and set it as a secret:

```bash
wrangler secret put MAL_CLIENT_ID
```

Responses are edge-cached for 30 minutes.

## Point LazyMAL at it

The frontend reads `VITE_API_BASE` (falls back to `https://api.jikan.moe/v4`). Add to the app's root `.env`:

```
VITE_API_BASE=https://lazymal-api.<your-subdomain>.workers.dev
```

then rebuild. All requests (`/seasons/now`, `/top/manga`, …) now hit your Worker.

## Notes / limitations

- Scraped cards expose what the season / top-manga pages contain (title, image, score, members, genres, type, episodes/volumes, synopsis on the season page). Fields MAL doesn't render there (rank, popularity, broadcast, studios) come back `null`/empty — use `?source=official` for the full set.
- Scraped genres have `mal_id: 0` (the app matches genres by name).
- This is a focused subset, not a 1:1 clone of Jikan's ~100 endpoints; it's structured so more can be added incrementally.
