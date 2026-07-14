# 🌸 LazyMAL

> A slick, mobile-first web app for browsing the current anime season.

## Features

- **Current-season browsing** — see what's airing right now at a glance
- **Genre filtering** — narrow the lineup down to the genres you care about
- **Sort options** — order titles by score, popularity, and more
- **Browse past & future seasons** — jump backward or forward through the seasonal archive
- **Mobile-app UI** — a polished, native-feeling interface built for the small screen
- **Infinite scroll** — keep discovering without ever hitting a "next page" button

## Tech Stack

- **[React 19](https://react.dev)** — UI library
- **[Vite](https://vite.dev)** — build tool and dev server
- **[TypeScript](https://www.typescriptlang.org)** — type-safe JavaScript
- **[Tailwind CSS v4](https://tailwindcss.com)** — utility-first styling
- **[Zustand](https://zustand-demo.pmnd.rs)** — state management
- **[shadcn/ui](https://ui.shadcn.com)** — accessible component primitives
- **[motion](https://motion.dev)** — animations (framer-motion)
- **[Jikan API](https://jikan.moe)** — the open-source, unofficial MyAnimeList API

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build
```

## Deployment

LazyMAL auto-deploys to **GitHub Pages** via the included GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Every push to the
`main` branch triggers a build and deploy.

> **Note:** The `base` option in `vite.config.ts` must match your repository name
> (currently `/lazymal/`). If you fork or rename the repo, update `base` accordingly
> so that asset paths resolve correctly on GitHub Pages.

## Credits

Data provided by the [Jikan API](https://jikan.moe), an open-source, unofficial
[MyAnimeList](https://myanimelist.net) API. LazyMAL is not affiliated with or
endorsed by MyAnimeList.
