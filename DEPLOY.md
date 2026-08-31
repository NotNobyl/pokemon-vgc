# Deploying VGC Companion to your Android phone (zero hosting on the work PC)

This is a **static PWA**. You build it here, publish the static `dist/` folder to a
free static host once, then install it on your Android phone from that URL. After
the first load it works **fully offline** — team building, meta dashboard, matchup
lab, and any Champions Battle Data you've synced are cached in the phone's
IndexedDB + service worker cache. Nothing runs on your work machine.

> Data source: Champions Battle Data API (championsbattledata.com). CORS is
> enabled, so the phone fetches usage data directly — no proxy/backend needed.

---

## What "runs 100% on Android" means here

- **Install:** a static host serves the files over HTTPS **once** so Chrome on
  Android can install the PWA. This is not hosting on your work PC.
- **After install:** the app + your data live on the phone. It launches from the
  home screen, works offline, and only reaches out to the API when you tap
  "Sync usage data" (and you can do that on your phone's own network).

---

## Option A — Netlify Drop (fastest, root domain, recommended)

1. On this PC: build the site.
   ```powershell
   npm install      # first time only
   npm run build
   ```
2. Go to https://app.netlify.com/drop (from any browser — your phone works too).
3. Drag the entire `dist/` folder onto the page. You get a URL like
   `https://<random-name>.netlify.app`.
4. On your Android phone, open that URL in Chrome → menu (⋮) → **Install app** /
   **Add to Home screen**.
5. Launch from the home screen. Open the **Data** tab and tap **Sync usage data**
   once while online. Done — it now works offline.

Netlify Drop needs no account for a quick deploy. `base` stays `/`, so no extra
config.

---

## Option B — Cloudflare Pages (free, root domain, account required)

1. `npm run build`
2. Create a Cloudflare Pages project, upload `dist/` (direct upload) or connect
   the Git repo with build command `npm run build` and output dir `dist`.
3. Install from the `*.pages.dev` URL on your phone as in Option A.

---

## Option C — GitHub Pages (free, project subpath)

GitHub Pages project sites serve under a subpath (`/<repo>/`), so build with the
base set and generate the SPA fallback:

```powershell
$env:VITE_BASE="/<your-repo-name>/"
npm run build:pages          # builds + writes dist/404.html + .nojekyll
Remove-Item Env:\VITE_BASE
```

Then publish `dist/` to the `gh-pages` branch (e.g. with the `gh-pages` npm tool,
or by committing `dist/` to that branch), and enable Pages for that branch in the
repo settings. Install from `https://<user>.github.io/<repo>/` on your phone.

The app is fully base-path aware (router, manifest, icons, service worker, and
Vite asset URLs all respect `VITE_BASE`), so it works correctly under the subpath.

---

## Option D — One-time LAN install (no external host at all)

If your phone and this PC are on the **same non-work network** (e.g. a phone
hotspot — do not do this on the corporate LAN if policy forbids it):

```powershell
npm run build
npm run preview -- --host   # serves dist/ on http://<pc-ip>:4173
```

Open `http://<pc-ip>:4173` on the phone and install. Note: some Android versions
require HTTPS for full PWA install; `http://` on a LAN IP may only allow
"Add to Home screen" as a shortcut rather than a true installed PWA. The free
static hosts (A–C) are the reliable install path.

---

## Verifying the offline install on the phone

1. Install and open the app.
2. Data tab → **Sync usage data** while online (pulls ~230 Champions mons; paced
   politely, takes a bit).
3. Turn on airplane mode.
4. Relaunch from the home screen — the app shell loads, and Team Builder / Meta /
   Matchup Lab still show the synced usage. Fresh syncs need connectivity again.

---

## Updating later

Re-run the build and re-publish `dist/`. Bump `CACHE_VERSION` in `public/sw.js`
whenever you deploy so the phone picks up new assets on next launch. (Vite hashes
JS/CSS filenames, so stale caching is limited to the app shell, which the version
bump clears.)

---

## Attribution (required by the data source)

The app displays: *"Battle data provided by Pokémon Champions Battle Data"* with a
link to championsbattledata.com, per their API terms. Keep that visible.
