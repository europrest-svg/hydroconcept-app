# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce este acest proiect

O **aplicație web progresivă (PWA)** pentru Hydro Concept (Euro-Prest Provider S.R.L.), o
firmă românească de hidroizolații/acoperișuri. Este un instrument intern de vânzări pe
teren — gestionează oferte, un centralizator de clienți, generare de mesaje, un constructor
de devize, un calculator, galerie foto, calendar, urmărire profit și exporturi. Întreaga
interfață este în **română**; păstrează toate textele vizibile utilizatorului, comentariile,
mesajele de commit și identificatorii consecvenți cu această limbă și cu tonul existent
(emoji în toast-uri/butoane este stilul consacrat).

**Nu există sistem de build, framework, manager de pachete sau teste.** Întreaga aplicație
este JS/HTML/CSS vanilla scris de mână, într-un singur fișier. Nu introduce un toolchain,
bundler sau dependențe npm decât dacă ți se cere explicit.

## Rulare și „deploy”

- Deschide direct `HydroConcept_App.html` sau servește directorul static:
  `python3 -m http.server 8000`, apoi accesează `http://localhost:8000/`.
- `index.html` este o redirecționare de o linie către `HydroConcept_App.html`.
- „Deploy-ul” înseamnă pur și simplu **commit și push pe `master`** — aplicația este servită
  de pe GitHub (Pages / raw). Nu există CI, lint sau pas de testare. Modificările aduse
  HTML-ului devin active imediat ce sunt servite.

### Incrementarea versiunii (esențial pentru ca actualizările să ajungă la utilizatori)

Aplicația își actualizează agresiv clienții. Când modifici `HydroConcept_App.html`,
**trebuie să incrementezi `APP_VERSION`** (aproape de finalul scriptului inline, formatul
`'AAAA.LL.ZZ.N'`) ca să forțezi clienții deja instalați să preia modificarea. Mecanismul:

- `checkRemoteVersion()` re-descarcă HTML-ul la fiecare 60s, extrage prin regex
  `APP_VERSION='...'` și, dacă diferă de versiunea care rulează, **șterge toate cache-urile,
  dezînregistrează service worker-ul și reîncarcă forțat pagina**.
- Service worker-ul (`sw.js`) servește HTML-ul **doar din rețea** (niciodată din cache) și
  pune în cache doar resursele statice. Când modifici `sw.js`, incrementează `CACHE_NAME`
  (`hc-app-vNN`), ca handler-ul `activate` să șteargă cache-urile vechi.

Dacă editezi aplicația și uiți să incrementezi `APP_VERSION`, utilizatorii vor continua să
ruleze codul vechi.

## Arhitectură

### SPA într-un singur fișier

`HydroConcept_App.html` (~5200 de linii) conține tot: `<style>` (liniile ~22–541), markup-ul
tuturor paginilor (~541–1362) și un singur `<script>` inline (~1362–5211). Nu există module
sau import-uri — fiecare funcție este globală. Când adaugi o funcție, definește-o ca
`function nume(){}` la nivel superior, lângă celelalte; interfața se leagă de ea prin
atribute `onclick="..."` inline.

**Navigarea între pagini/tab-uri** se face cu `showPage('nume')`: comută `.active` pe div-urile
`.page` (`id="page-<nume>"`) și pe butoanele `.tab` din bara de jos, apoi apelează funcția de
randare a acelei pagini. Paginile sunt: `dashboard`, `oferte`, `centralizator`, `calendar`,
`galerie`, `profit`, `mesaje`, `calculator`, `pipeline`, `devize`, `export`, `setari`. Fiecare
pagină interactivă are o funcție `render<Pagina>()` care reconstruiește DOM-ul din
localStorage — nu există binding reactiv de date, așa că **după ce modifici datele trebuie să
apelezi funcția de randare relevantă** (sau `updateBadge()`) ca să reîmprospătezi vizualizarea.

### Modelul de date și persistența

**Toată starea trăiește în `localStorage`** ca JSON; nu există backend cu bază de date.
Accesul se face prin perechi mici getter/setter — folosește-le în loc să atingi direct
`localStorage`:

| Cheie | Accesoare | Conținut |
|-------|-----------|----------|
| `hc_data` | `getAll()` / `saveAll()` | array de înregistrări ofertă/client (entitatea de bază) |
| `hc_devize` | `getDevize()` / `saveDevize()` | devize salvate |
| `hc_lucrari` | `getLucrari()` / `saveLucrari()` | lucrări din calendar |
| `hc_echipe` | `getEchipe()` / `saveEchipe()` | echipe de lucru |
| `hc_photos` | `getPhotos()` / `savePhotos()` | metadate poze din galerie |
| `hc_custom_materiale` | `getCustomMateriale()` / `saveCustomMateriale()` | materiale adăugate de utilizator |
| `hc_costs` | `getCosts()` | costuri per ofertă pentru calculul profitului |
| `hc_reminders_state` | `getReminderState()` / `saveReminderState()` | stare snooze/dismiss remindere |
| `hc_pin`, `hc_pin_active` | `getPin()` / `isPinActive()` | blocare cu PIN a paginii profit |
| `hc_gh_token`, `hc_sync_ts` | `getGHToken()` / `saveGHToken()` | sincronizare cloud (vezi mai jos) |
| `hc_theme` | `loadTheme()` / `toggleTheme()` | temă light/dark |
| `hc_seeded_v5`, `hc_just_seeded` | — | gardiene pentru seed |

O înregistrare de client este un obiect plat: `{nr, client, telefon, email, obiectiv,
suprafata, valoare, dataOferta, oferta, contract, deviz, pv, factura, statusPlata, obs, id}`.
`id` este `1000000 + index` pentru rândurile inițializate (seed). `valoare` este un **string
liber** ("31.150 lei", "21.080 €", "110 lei/mp") — nu presupune niciodată că este număr;
parsează-l cu helperii existenți `parseVal` / `parseValNum` / `isEuro` (euro este convertit la
`CURS` ≈ 5 lei). Datele sunt string-uri românești `zz.ll.aaaa` — parsează-le cu `parseRoDate`
/ `daysAgo`.

`seedData()` încarcă cei 22 de clienți istorici din constanta hard-codată `HC` la prima rulare
(protejat de `hc_seeded_v5`). Profilul firmei este constanta hard-codată `F`; nivelurile de
produse/prețurile sunt în `P`, `COMPARE_ROWS`, `STEPS`, `BENEFITS`; template-urile de devize în
`DEVIZ_TEMPLATES`, iar catalogul de materiale în `DEVIZ_MATERIALE_CATALOG`. Aceste constante
sunt sursa de adevăr pentru conținutul ofertelor — editează-le în loc să duplici valorile
inline.

### Sincronizare cloud (GitHub ca bază de date)

Sincronizarea între dispozitive folosește **GitHub Contents API pentru a citi/scrie `sync.json`
din acest repo**: `GH_REPO='europrest-svg/hydroconcept-app'`, `GH_FILE='sync.json'`.
Utilizatorul lipește un token personal de acces (`hc_gh_token`) în Setări.

- `saveAll()` declanșează `autoCloudPush()` → debounce 5s → `cloudPushSilent()` (PUT către
  Contents API, după ce ia mai întâi `sha`-ul curent).
- `cloudPull()` rulează la ~4s după încărcare și la fiecare 60s; aplică payload-ul remote
  **doar dacă `sync_ts` este mai nou** decât cel local (last-write-wins, fără merge).
- Prin urmare, `sync.json` din repo reprezintă **date live ale utilizatorului pe care
  aplicația le suprascrie**, nu configurare sursă. Tratează-l ca date, nu ca pe cod — nu-l
  edita manual așteptându-te să rămână.

### Documente persistate (IndexedDB)

Documentele de ofertă încărcate (PDF/DOCX) sunt stocate în **IndexedDB** (`docDB`, prin
`openDocDB` / `saveDoc` / `getDoc` / `delDoc`), indexate per ofertă — separat de starea din
localStorage. Extragerea textului din PDF folosește pdf.js; parsarea DOCX folosește mammoth;
generarea DOCX folosește biblioteca `docx` + FileSaver — toate încărcate de pe CDN în `<head>`
și listate în cache-ul de resurse al service worker-ului.

### Pagini publice însoțitoare

Aceste fișiere HTML de sine stătătoare împart stilul de brand, dar sunt independente de shell-ul
aplicației:

- `cerere.html` — formular public „cerere de ofertă”; trimite prin deschiderea unui link
  **WhatsApp** către admin (`wa.me/40720139220`). Fără server.
- `oferta-public.html` — randează o ofertă partajabilă dintr-un **payload base64 din hash-ul
  URL** (`generatePublicOfferLink()` din aplicație produce aceste linkuri).
- `portofoliu.html`, `testimoniale.html` — pagini de prezentare/marketing.

## Convenții

- **Incrementează `APP_VERSION` la fiecare modificare a `HydroConcept_App.html`** și
  `CACHE_NAME` la fiecare modificare a `sw.js`. Este cea mai importantă regulă.
- Respectă stilul vanilla existent, dens, într-un singur fișier: globale, handler-e `onclick`
  inline, declarații `function` grupate pe funcționalitate cu bannere de comentarii `═══`, și
  helperii `v(id)` (valoare input trimuită), `nr(n)` (format numeric ro-RO), `toast(msg)`.
- Citește/scrie starea doar prin perechile getter/setter de mai sus și re-randează pagina
  afectată după ce modifici datele.
- Păstrează tot textul de interfață în română.
