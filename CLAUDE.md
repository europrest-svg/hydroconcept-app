# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Progressive Web App** for Hydro Concept (Euro-Prest Provider S.R.L.), a Romanian
waterproofing/roofing company. It is an internal field-sales tool — it manages offers,
a client centralizer, message generation, an offer/quote (deviz) builder, a calculator,
photo gallery, calendar, profit tracking, and exports. The entire UI is in **Romanian**;
keep all user-facing strings, comments, commit messages, and identifiers consistent with
that language and the existing tone (emoji in toasts/buttons is the established style).

There is **no build system, no framework, no package manager, and no tests.** The whole
application is hand-written vanilla HTML/CSS/JS in a single file. Do not introduce a
toolchain, bundler, or npm dependencies unless explicitly asked.

## Running & "deploying"

- Open `HydroConcept_App.html` directly, or serve the directory statically:
  `python3 -m http.server 8000` then visit `http://localhost:8000/`.
- `index.html` is a one-line redirect to `HydroConcept_App.html`.
- "Deployment" is just **committing and pushing to `master`** — the app is served from
  GitHub (Pages / raw). There is no CI, lint, or test step. Changes to the HTML go live
  as soon as they are served.

### Version bumping (critical for updates to reach users)

The app aggressively self-updates clients. When you change `HydroConcept_App.html`, you
**must bump `APP_VERSION`** (near the bottom of the inline script, format
`'YYYY.MM.DD.N'`) so deployed clients pick up the change. The mechanism:

- `checkRemoteVersion()` re-fetches the HTML every 60s, regex-matches `APP_VERSION='...'`,
  and if it differs from the running version, **nukes all caches, unregisters the service
  worker, and force-reloads**.
- The service worker (`sw.js`) serves HTML **network-only** (never cached) and caches only
  static assets. When you change `sw.js`, bump `CACHE_NAME` (`hc-app-vNN`) so the
  `activate` handler purges old caches.

If you edit the app and forget to bump `APP_VERSION`, users will keep running the old code.

## Architecture

### Single-file SPA

`HydroConcept_App.html` (~5200 lines) contains everything: `<style>` (lines ~22–541),
the markup for all pages (~541–1362), and one inline `<script>` (~1362–5211). There are
no modules or imports — every function is a global. When adding a function, define it as a
top-level `function name(){}` alongside the others; UI wires to it via inline
`onclick="..."` attributes.

**Page/tab navigation** is `showPage('name')`: it toggles `.active` on `.page` divs
(`id="page-<name>"`) and bottom-nav `.tab` buttons, then calls that page's render function.
The pages are: `dashboard`, `oferte`, `centralizator`, `calendar`, `galerie`, `profit`,
`mesaje`, `calculator`, `pipeline`, `devize`, `export`, `setari`. Each interactive page has
a matching `render<Page>()` that rebuilds its DOM from localStorage — there is no reactive
data binding, so **after mutating data you must call the relevant render function** (or
`updateBadge()`) to refresh the view.

### Data model & persistence

**All state lives in `localStorage`** as JSON; there is no backend database. Access goes
through small getter/setter pairs — use them rather than touching `localStorage` directly:

| Key | Accessors | Contents |
|-----|-----------|----------|
| `hc_data` | `getAll()` / `saveAll()` | array of offer/client records (the core entity) |
| `hc_devize` | `getDevize()` / `saveDevize()` | saved quotes |
| `hc_lucrari` | `getLucrari()` / `saveLucrari()` | calendar jobs |
| `hc_echipe` | `getEchipe()` / `saveEchipe()` | work teams |
| `hc_photos` | `getPhotos()` / `savePhotos()` | gallery photo metadata |
| `hc_custom_materiale` | `getCustomMateriale()` / `saveCustomMateriale()` | user-added materials |
| `hc_costs` | `getCosts()` | per-offer cost inputs for profit calc |
| `hc_reminders_state` | `getReminderState()` / `saveReminderState()` | snooze/dismiss state |
| `hc_pin`, `hc_pin_active` | `getPin()` / `isPinActive()` | profit-page PIN lock |
| `hc_gh_token`, `hc_sync_ts` | `getGHToken()` / `saveGHToken()` | cloud sync (see below) |
| `hc_theme` | `loadTheme()` / `toggleTheme()` | light/dark |
| `hc_seeded_v5`, `hc_just_seeded` | — | seed guards |

A client record is a flat object: `{nr, client, telefon, email, obiectiv, suprafata,
valoare, dataOferta, oferta, contract, deviz, pv, factura, statusPlata, obs, id}`. `id` is
`1000000 + index` for seeded rows. `valoare` is a **free-text string** ("31.150 lei",
"21.080 €", "110 lei/mp") — never assume it is a number; parse it with the existing
`parseVal` / `parseValNum` / `isEuro` helpers (euro is converted at `CURS` ≈ 5 lei).
Dates are Romanian `dd.mm.yyyy` strings — parse with `parseRoDate` / `daysAgo`.

`seedData()` loads the 22 historical clients from the hard-coded `HC` constant on first run
(guarded by `hc_seeded_v5`). The company profile is the hard-coded `F` constant; product
tiers/pricing live in `P`, `COMPARE_ROWS`, `STEPS`, `BENEFITS`; quote templates in
`DEVIZ_TEMPLATES` and the material catalog `DEVIZ_MATERIALE_CATALOG`. These constants are
the source of truth for offer content — edit them rather than duplicating values inline.

### Cloud sync (GitHub-as-database)

Multi-device sync uses the **GitHub Contents API to read/write `sync.json` in this repo**:
`GH_REPO='europrest-svg/hydroconcept-app'`, `GH_FILE='sync.json'`. The user pastes a
personal access token (`hc_gh_token`) in Settings.

- `saveAll()` triggers `autoCloudPush()` → debounced 5s → `cloudPushSilent()` (PUT to the
  Contents API, fetching the current `sha` first).
- `cloudPull()` runs ~4s after load and every 60s; it applies the remote payload **only if
  `sync_ts` is newer** than the local one (last-write-wins, no merge).
- `sync.json` in the repo is therefore **live user data that the app overwrites**, not
  source config. Treat it as data, not code — don't hand-edit it expecting it to stick.

### Persisted documents (IndexedDB)

Uploaded offer documents (PDF/DOCX) are stored in **IndexedDB** (`docDB`, via
`openDocDB` / `saveDoc` / `getDoc` / `delDoc`), keyed per offer — separate from the
localStorage state. PDF text extraction uses pdf.js; DOCX parsing uses mammoth; DOCX
generation uses the `docx` library + FileSaver — all loaded from CDN in `<head>` and listed
in the service worker's asset cache.

### Companion public pages

These standalone HTML files share the brand styling but are independent of the app shell:

- `cerere.html` — public "request a quote" form; submits by opening a **WhatsApp** link to
  the admin (`wa.me/40720139220`). No server.
- `oferta-public.html` — renders a shareable offer from a **base64 payload in the URL hash**
  (`generatePublicOfferLink()` in the app produces these links).
- `portofoliu.html`, `testimoniale.html` — marketing/landing pages.

## Conventions

- **Bump `APP_VERSION` on every change to `HydroConcept_App.html`**, and `CACHE_NAME` on
  every change to `sw.js`. This is the single most important rule.
- Match the existing dense, single-file vanilla style: globals, inline `onclick` handlers,
  `function` declarations grouped by feature with `═══` comment banners, and the helpers
  `v(id)` (trimmed input value), `nr(n)` (ro-RO number format), `toast(msg)`.
- Read/write state only through the getter/setter pairs above, and re-render the affected
  page after mutating.
- Keep all UI text in Romanian.
