# Zombles 🧟

GeoGuessr × Wordle for **Call of Duty: Black Ops** and **Black Ops II** Zombies maps.
You get one screenshot, zoomed way in. Five guesses. Every wrong guess zooms out.

- **Daily**: the same puzzle for everyone, picked deterministically from the local date. No backend.
- **Endless**: random images, no repeats until you've seen them all.

Vite + vanilla TypeScript, fully static, deploys to GitHub Pages.

## Setup

Requires Node **22.18+** (the fetch script imports `src/config.ts` using Node's built-in type stripping).

```bash
npm install
npm run dev        # http://localhost:5173
```

Out of the box the game runs on **16 placeholder images**, one solid-color card per map. A banner in the app says so. Replace them with real screenshots as described below.

## Image workflow: fetch → curate → promote

### 1. Fetch candidates from the wiki

```bash
npm run fetch -- kino-der-toten       # one map (slugs are in shared/maps.js)
npm run fetch                          # all 16 maps
npm run fetch -- --dry-run moon        # show what would be downloaded
```

`scripts/fetch-wiki.js` uses the MediaWiki API on callofduty.fandom.com, not HTML scraping:

1. `list=categorymembers&cmtype=file` on each map's image category (`wikiCategory` in `shared/maps.js`).
2. `prop=imageinfo&iiprop=url|size|mime|user|extmetadata` in batches of 50 to get original URLs and dimensions.
3. Filters out non-screenshots:
   - names containing logo, icon, concept, render, menu, loading, achievement, trophy, BO3, BOIII, Chronicles, comparison, map layout, or radar
   - names that point at other games (black ops 3/iii, BO4, black ops 4, WaW, world at war, CODV/Vanguard, CODM/mobile, iPod/iPhone) or aren't screenshots (promo, wallpaper, comic)
   - anything under 600px wide
   - aspect ratios outside 4:3 to 21:9
   - anything that isn't a JPEG, PNG or WebP
4. Keeps the `MAX_CANDIDATES_PER_MAP` (25) largest images and downloads them to `raw/<slug>/` under their original filenames. Files already there are skipped.
5. Records every download in `raw/sources.json`: wiki file page, original URL, uploader, license, and an attribution line.

The script is polite: requests are at least 1.1s apart, it sends a descriptive User-Agent, and it checks robots.txt. Set `ZOMBLES_CONTACT` to add your repo URL or email to the User-Agent:

```bash
ZOMBLES_CONTACT="https://github.com/you/zombles" npm run fetch
```

Fandom puts robots.txt behind a Cloudflare browser check, so scripts usually can't read it. When that happens the script falls back to a hand-copied snapshot of the `User-agent: *` rules, which allow `/api.php?action=…`. It logs which source it used.

### 2. Curate

Open `raw/<slug>/` and **delete anything that's bad for the game**: HUD-heavy shots, character close-ups, promo art, duplicates, shots from other games, and anything too easy or too obscure. `raw/` is git-ignored and never ships.

### 3. Promote

```bash
npm run promote
npm run promote -- --keep-placeholders   # keep placeholders for maps with no real shots yet
```

`scripts/promote.js` copies what's left into `public/maps/` as `<hash>.<ext>`, where the hash comes from the file's contents. It then rewrites `public/maps/manifest.json`:

```json
[
  {"id":"a3f9c2e1","file":"a3f9c2e1.jpg","slug":"5be0c1d27f","focalX":0.5,"focalY":0.5}
]
```

- It removes placeholders and stale files.
- Maps with no images left get a warning. They can't be an answer until they have one.
- **Focal points**: by default zoom centers on the middle of the image. Edit `focalX`/`focalY` (0–1, measured from the top-left) in `manifest.json` to point the zoom at a better detail. Hand edits are kept when you re-run promote, matched by `id`.

Run `npm run placeholders` to go back to the placeholder set (`--force` if real images are present).

## Spoiler model

The client never sees a plain answer:

- Image URLs are content hashes. There are no per-map folders and no map names in filenames.
- The manifest's `slug` field holds `answerToken(id, slug)`, a hash of the image id plus the real slug (`shared/hash.js`). A guess is correct when `answerToken(id, guess) === entry.slug`.
- The answer is only worked out (by trying all 16 slugs) for the end-of-round reveal and the BO1/BO2 hint.

This is a static site, so a determined player with devtools can still hash all 16 slugs. The goal is to keep answers out of view-source, the network tab and the DOM, not to stop someone who's set on cheating.

## Configuration

`src/config.ts`:

| Constant | Default | Meaning |
| --- | --- | --- |
| `MAX_GUESSES` | 5 | Guesses per round |
| `ZOOM_STEPS` | `[4, 3, 2.2, 1.6, 1]` | Zoom shown before guess 1…5 |
| `HINT_AFTER_GUESS` | 2 | Show the BO1/BO2 chip after this many wrong guesses |
| `MAX_CANDIDATES_PER_MAP` | 25 | Download cap per map for `npm run fetch` |
| `DAILY_EPOCH` | `2026-01-01` | Date of daily puzzle #1 |
| `ZOOM_MS` | 400 | Zoom animation duration |

Map names, aliases for the autocomplete, and wiki categories are in `shared/maps.js`. The Node scripts and the client share this file.

Colors are CSS variables at the top of `src/style.css`.

## How the daily puzzle is picked

The manifest is sorted by id, shuffled with a fixed seed, and day *N* (counting from `DAILY_EPOCH`, using the local date) gets image `N mod count`. Every player gets the same image on the same date, and no image repeats until all have been used. **Adding or removing images reshuffles future dailies.** That's harmless, but promote between days, not mid-day.

## Deploy to GitHub Pages

1. Push to a GitHub repo with `main` as the default branch.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` builds and deploys.

`vite.config.ts` uses `base: './'`, so the site works at `https://<user>.github.io/<repo>/` without setting the repo name.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run fetch [-- slug…]` | Download candidate screenshots to `raw/` |
| `npm run promote` | `raw/` → `public/maps/` and `manifest.json` |
| `npm run placeholders` | Regenerate the placeholder set |

## Credits

Images are sourced from the [Call of Duty Wiki](https://callofduty.fandom.com/). Per-image attribution is in `raw/sources.json`. Call of Duty and all game imagery © Activision. This is a non-commercial fan project and isn't affiliated with Activision or Fandom.
