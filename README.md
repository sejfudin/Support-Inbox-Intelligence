# Support-Inbox-Intelligence

Support-Inbox-Intelligence is a full-stack internship & talent-management platform with a built-in, workspace-scoped ticketing / project-work module. It is built with a React + Vite frontend and a Node.js + Express backend, and ships with real-time collaboration, AI-assisted workflows, file storage, and a GitHub App integration.

The platform serves two connected domains:

- **Programme management** — onboard interns, assign mentors, record evaluations and mentor comments, track readiness for placement, manage recommendations, and give leadership dashboards over the full pipeline.
- **Ticketing / project work** — workspace-scoped tickets with customizable statuses, priorities, story points, time tracking, threaded comments with mentions, an audit history, board (drag-and-drop) and table views, archiving, and CSV export.

## Key features

- JWT authentication with short-lived access tokens and rotating refresh tokens
- Multi-tenant **workspaces** with members, invitations, custom logos, and per-workspace ticket statuses & categories
- **Ticketing**: board and table views, drag-and-drop, priorities, story points, time-in-status tracking, threaded comments with @mentions, full change history, image attachments, and CSV export
- **Internship programme**: intern profiles, primary/secondary mentors, evaluations, mentor comments, readiness flags, technologies, internship types, hubs, CV uploads, and documentation links
- **Recommendations & leadership dashboards**: candidate pipeline, funnels, KPIs, and placement views
- **AI assistance** (via Groq): ticket summaries, suggested replies, AI-generated ticket descriptions, metadata suggestions, and analytics summaries
- **Real-time updates** over Socket.IO (user, workspace, and ticket rooms) with authenticated handshakes and rate limiting
- **GitHub App integration**: link pull requests to tickets via webhooks
- Analytics with charts (personal and workspace level)
- Responsive, themeable UI (light/dark) built with TailwindCSS and Radix UI primitives

## User roles

The platform defines four roles (`server/constants/roles.js`). Each role lands on a different home view after login and is restricted by route guards (`frontend/src/routes`).

| Role           | Lands on                                          | Description & permissions                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**      | `/admin/workspaces`                               | Full platform access. Manages users, workspaces, and reference data (hubs, technologies, internship types), can register new users, and has visibility over every workspace and intern. Bypasses workspace membership checks for tickets and rooms. |
| **Mentor**     | `/my-interns` (or `/dashboard` if in a workspace) | Guides assigned interns: adds evaluations and mentor comments, sets readiness flags, manages recommendations, and reviews intern profiles. Also works inside workspaces on tickets/projects.                                                        |
| **Leadership** | `/programme`                                      | Stakeholder / TA visibility (read-oriented). Sees the programme dashboard, candidate pipeline and funnels, and individual intern profiles. Has no workspace/ticket workflow — redirected to `/programme` from those routes.                         |
| **Intern**     | `/dashboard` or `/create-workspace`               | Active programme participant. Manages their own profile (technologies, CV, documentation links) and works on assigned tickets/projects within their workspace.                                                                                      |

> Roles are assigned at the user level. Workspaces additionally have their own membership roles (`admin` / `member`) that control per-workspace management actions, independent of the platform role above.

## Tech stack

- **Frontend**: React 19 + Vite 7, TailwindCSS 3, Radix UI + shadcn-style components, `@tanstack/react-query` & `@tanstack/react-table`, React Router 7, `@dnd-kit` (drag-and-drop), TipTap (rich text), Recharts (charts), Framer Motion, React Hook Form + Zod, Socket.IO client, Sonner (toasts), next-themes
- **Backend**: Node.js + Express 5, Mongoose 9 (MongoDB), Socket.IO, Multer (uploads), `sanitize-html`, bcryptjs
- **Auth**: JWT access + refresh tokens (HTTP-only cookies)
- **Storage**: Supabase Storage (image attachments, workspace logos, intern CVs)
- **AI**: Groq (HTTP API) for summaries, suggested replies, and description generation
- **Integrations**: GitHub App (webhooks + PR linking, RS256 JWT, encrypted installation tokens)
- **Dev tooling**: Vite, nodemon, ESLint, Prettier

## Repository layout

```
/frontend                 # React + Vite app
  src/
    api/                   # axios client + per-resource API helpers
    components/            # UI, tickets, interns, analytics, symphony dashboard, shadcn ui/
    pages/                 # route pages (Backlog, TicketPage, Admin*, Mentor*, fep/Leadership*)
    layouts/               # SidebarLayout, SymphonyLayout
    routes/                # AppRoutes + route guards
    context/               # Auth, Socket, ThemeConfig providers
    hooks/ helpers/ lib/   # React hooks, pure helpers, query-cache utilities

/server                   # Express API server
  index.js                # app entry (also serves the built frontend in production)
  config/                 # db.js (Mongoose), supabase.js
  routes/ controllers/    # HTTP layer
  services/               # business logic (auth, tickets, interns, AI, github, analytics, ...)
  models/                 # Mongoose models (User, Ticket, Workspace, InternProfile, ...)
  socket/                 # Socket.IO server, events, invalidation scopes
  middleware/ helpers/    # auth, role guards, uploads, crypto, validation
  prompts/                # AI prompt templates
  seeder/                 # seedDemoData.js + demo/, seed.js, seedTestingData.js, reference data

README.md
```

## Prerequisites

- Node.js >= 18
- npm
- A MongoDB instance (local or cloud)
- A Supabase project with Storage buckets (required for file uploads / server startup)
- _Optional:_ a Groq API key (AI features) and a GitHub App (PR linking)

## Environment variables

Create a `.env` file in the `server/` directory. The server **requires** the MongoDB and Supabase variables to start; the AI and GitHub variables are optional and only needed for those features.

```bash
# Core
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173      # frontend origin used by CORS and Socket.IO
SERVER_URL=http://localhost:4000      # public server URL (used for GitHub callbacks)
PORT=4000                             # optional, defaults to 4000
NODE_ENV=development

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Supabase Storage (required — server throws on startup if missing)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ATTACHMENT_BUCKET=attachment-images
SUPABASE_WORKSPACE_LOGO_BUCKET=workspace-logos
SUPABASE_CV_BUCKET=intern-cvs         # must allow application/pdf; falls back to the logo bucket
SUPABASE_BUCKET_VISIBILITY=private    # 'private' (default) or 'public'

# AI (Groq) — optional; enables AI summaries, suggestions, and descriptions
GROQ_URL=https://api.groq.com/openai/v1/responses
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_groq_model
GROQ_TIMEOUT_MS=15000

# GitHub App — optional; enables PR linking
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_NAME=your_github_app_name
GITHUB_PRIVATE_KEY=your_github_app_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_ENCRYPTION_KEY=your_encryption_key   # encrypts stored installation tokens
```

Notes:

- `MONGODB_URI` is used by `server/config/db.js` to connect Mongoose.
- `CLIENT_URL` configures CORS in `server/index.js` and the Socket.IO server.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` sign access and refresh tokens.
- Supabase URL, service-role key, attachment bucket, and workspace-logo bucket are validated at startup — the server will not boot without them.
- When the Groq variables are unset, AI endpoints respond with a "not configured" error instead of failing the whole server.

## Local development

1. Install dependencies for the backend and frontend:

```bash
cd server && npm install
cd ../frontend && npm install
```

2. Start the backend (in `server/`):

```bash
npm run dev      # nodemon index.js
```

3. Start the frontend (in `frontend/`):

```bash
npm run dev      # Vite dev server, default http://localhost:5173
```

Open the URL printed by Vite (commonly http://localhost:5173). In production, the server also serves the built frontend from `frontend/dist` with an SPA fallback, so a single `node index.js` can host both API and UI.

## Available scripts

**Frontend** (`frontend/package.json`):

- `npm run dev` — start the Vite dev server
- `npm run build` — build production assets to `dist/`
- `npm run preview` — serve the built assets locally
- `npm run format` / `npm run format:check` — Prettier write / check

**Server** (`server/package.json`):

- `npm run dev` — start with `nodemon` (auto-reload)
- `npm run start` — start with `node` (production)
- `npm run seed:demo` — wipe and rebuild a full demo dataset (interactive confirmation required)
- `npm run seed` — wipe the database and seed demo data (interactive confirmation required)
- `npm run seed:test` — seed a larger testing dataset
- `npm run seed:recommendations` — top up the placement pipeline only (additive and idempotent; `--dry-run` supported)
- `npm run seed:technologies` — upsert the Technology catalog only (non-destructive; `--dry-run` supported)
- `npm run format` / `npm run format:check` — Prettier write / check

## Seeding and admin

The `server/seeder/` directory contains three seeding scripts:

- `seedDemoData.js` (`npm run seed:demo`) — **the one to reach for.** Wipes transactional data and rebuilds one coherent dataset: four hero logins, 26 interns spread across every profile status (10 active / 6 ready / 5 placed / 3 completed / 2 discontinued, one of them a deactivated account) with ~8 weeks of attendance history, two workspaces with a populated ticket board, stand-ups in both, and a 38-recommendation placement pipeline covering every intern. **Preserves** reference data (hubs, internship types, technologies, positions) and the locked `unspecified` project. It is the only seeder that loads `.env.${NODE_ENV|development}` — the same file the server reads — so it targets the database `npm run dev` actually uses; the other two load plain `.env`, which may be a different cluster. Confirmation asks you to type the **database name**. Supports `--dry-run`, `--yes=<dbname>` for non-interactive runs, and `--checkin-today`. Fully deterministic, so re-running reproduces identical data — re-run it the morning of a demo so "today" is current.
- `seed.js` (`npm run seed`) — **destructive**: it deletes all collections, reseeds reference data (hubs, internship types, technologies), and creates a demo workspace plus default accounts. It prompts you to type `wipe` before deleting anything.
- `seedTestingData.js` (`npm run seed:test`) — seeds a richer dataset for testing (additional staff, interns across every status/programme, tickets, integrations, and invitations). Run it after `npm run seed`.

Alongside them, `seedRecommendations.js` (`npm run seed:recommendations`) is an **additive, idempotent** top-up of the placement pipeline: it inserts the recommendations from `seeder/demo/dataset.js` that are missing, and nothing else — no deletes, no updates to existing records. It resolves interns, authors and reference data by email and slug (so it works on a database whose users were created through the app), skips anything it cannot resolve with a printed reason, and re-checks each record against the intern's live profile status before writing. Because every record carries the demo seeder's deterministic `_id`, re-running inserts nothing. This is the seeding script to reach for on a shared dev database — `seed:demo` would change every user id and break everyone's open sessions. Supports `--dry-run` and `--yes=<dbname>`.

Alongside them, `seedTechnologies.js` (`npm run seed:technologies`) is a **non-destructive** catalog backfill: it upserts the entries in `seeder/defaultTechnologies.js` by slug with `$setOnInsert`, so nothing is renamed, deactivated or deleted. Run it after adding a technology — CV auto-detection can only recognize technologies that exist in the catalog, so a database seeded before the addition will keep missing them. `--dry-run` lists what would be added.

### Demo accounts

`npm run seed:demo` creates four hero accounts — **all with the password `password`**:

| Role       | Email                    | Name        |
| ---------- | ------------------------ | ----------- |
| Admin      | `admin@symphony.is`      | Sejfudin    |
| Mentor     | `mentor@symphony.is`     | Erik Muller |
| Intern     | `intern@symphony.is`     | Hamza Tuco  |
| Leadership | `leadership@symphony.is` | Enis Kudo   |

It also creates two background mentors (`boris.petrovic@`, `natasa.ilic@symphony.is`) and 26 interns at `firstname.lastname@symphony.is`, all with the same password — except `goran.stankovic@symphony.is`, whose account is deliberately deactivated so the disabled-user state is demo-able (login is rejected; the user still appears in the admin directory).

`npm run seed` creates:

| Role   | Email             | Password    |
| ------ | ----------------- | ----------- |
| Admin  | `admin@test.com`  | `admin123`  |
| Mentor | `mentor@test.com` | `mentor123` |

`npm run seed:test` adds Symphony staff and interns — **all of these use the password `password`**:

| Role       | Email                                                                       | Password   |
| ---------- | --------------------------------------------------------------------------- | ---------- |
| Leadership | `leadership@symphony.is`                                                    | `password` |
| Leadership | `leadership2@symphony.is`                                                   | `password` |
| Admin      | `admin@symphony.is`                                                         | `password` |
| Mentor     | `mentor.sarajevo@symphony.is`                                               | `password` |
| Mentor     | `mentor.belgrade@symphony.is`                                               | `password` |
| Mentor     | `mentor.novisad@symphony.is`                                                | `password` |
| Intern     | `intern.active.fep@symphony.is` (and other `intern.*@symphony.is` accounts) | `password` |

⚠️ Never run the seeders against a production database — they clear existing data.

## Authentication and security notes

- Short-lived JWT access tokens plus rotating refresh tokens (see `server/services/authService.js`); refresh tokens are persisted and tracked via a `tokenVersion`.
- Socket.IO connections are authenticated from the JWT handshake and validated against the current `tokenVersion`, with per-event rate limiting and room-level authorization.
- User-supplied HTML (comments, rich text) is sanitized with `sanitize-html`.
- Stored GitHub installation tokens are encrypted at rest using `GITHUB_ENCRYPTION_KEY`.

## Tests

There are no automated tests in this repository yet (`server`'s `test` script is a placeholder). Adding unit and integration tests for backend services and React components is a recommended next step.

## Contributing

Feel free to open issues and pull requests. For sizable changes, please open an issue first to discuss the approach.

## License

This repository does not specify a license. If you plan to open-source it, add a `LICENSE` file (e.g., MIT) to clarify terms.


# Carteo — promptovi za Instagram reklame

> Interni dokument · 07.08.2026 · privatni repo
>
> Promptovi za generisanje reklamnih slika, sa kontekstom šta svaki od njih
> proizvodi i gdje se koristi. Poslovna strana (cijena, prognoze) je u
> `PRODAJA.md`, brend sistem u `docs/DESIGN.md`.

**Sadržaj**

1. [Kontekst proizvoda](#1-kontekst-proizvoda)
2. [Dva pravila](#2-dva-pravila)
3. [Stilski blokovi](#3-stilski-blokovi)
4. [Negative prompt](#4-negative-prompt)
5. [Set A — 1:1, predstavlja aplikaciju](#5-set-a--11-predstavlja-aplikaciju)
6. [Set B — 4:5 i 9:16, priča i problem](#6-set-b--45-i-916-priča-i-problem)
7. [Radni tok](#7-radni-tok)

---

## 1. Kontekst proizvoda

Ovo je kontekst koji treba imati na umu pri generisanju — i koji se može zalijepiti
modelu ako traži pozadinu.

**Šta je Carteo.** SaaS za ugostiteljske objekte u BiH (kafići, barovi,
restorani). Vlasnik kroz web dashboard upravlja artiklima, cijenama, kategorijama,
slikama i ponudama. Gost skenira QR kod na stolu i otvara meni u browseru — bez
instalacije aplikacije. Kad vlasnik promijeni cijenu i objavi, gost je vidi odmah.
Uz to ide primanje narudžbi uživo i konobarski panel.

**Kome se obraća.** Vlasnicima malih i srednjih lokala u BiH. To nisu tehnički
ljudi. Kupuju rješenje za trošak i gnjavažu, ne za tehnologiju.

**Šta je stvarna prodajna poruka.** Ne "imamo digitalni meni" — to nudi i PDF na
Google Driveu. Nego: **cijena se mijenja u sekundi, meni se ne štampa ponovo.**
Jedno štampanje menija za 30 stolova košta 150–400 KM.

**Brend paleta** (iz `docs/DESIGN.md`):

| Uloga | Hex |
|---|---|
| Espresso (primarna) | `#5F3C1E` |
| Tamna espresso | `#3D2821` |
| Zlatna (akcent, štedljivo) | `#CEA35B` |
| Topla pozadina | `#FBF7F2` |
| Tinta (tekst) | `#241A12` |

Tipografija: **Poppins**. Ton: topao, zemljani, kafa — nikako plavo-tehnološki.

**Lokalni detalji koji čine slike autentičnim.** Fildžan, copper džezva,
pepeljara, plastične stolice na terasi, ogrebani drveni sto, radijator, poluspuštena
zavjesa. Generični "modern minimalist cafe" odmah izgleda kao stock fotografija.

---

## 2. Dva pravila

> **1. Nikad ne dati AI-u da crta UI.** Generiše se scena s telefonom čiji je ekran
> **taman, ugašen ili van kadra**. Pravi screenshot Carteo menija se lijepi naknadno
> u Canvi/Figmi. Lažni app ekran je najveći znak da je slika generisana.
>
> **2. Tekst reklame ide preko slike, ne u sliku.** Svaki prompt traži prazan
> kvadrant za natpis. Isto važi za QR kodove — AI generisani QR nikad ne radi, pa se
> traži **prazan bijeli kvadrat** i lijepi pravi.

---

## 3. Stilski blokovi

Dodaje se na **kraj** prompta. Drži serijal ujednačenim i skida plastični izgled.

**Za 1:1 (Set A):**

```
Square 1:1 composition. Subject placed slightly off-center, one quadrant left
deliberately empty for text. Shot on a Fujifilm X-T4, 35mm f/1.4, natural
available light only, slightly underexposed, fine visible grain, warm imperfect
white balance. Documentary product photography, not advertising. Real worn
materials, dust, fingerprints, uneven surfaces. Candid and unstyled.
```

**Za 4:5 i 9:16 (Set B):**

```
Shot on a Fujifilm X-T4 with a 35mm f/1.4 lens, natural available light only,
slightly underexposed, visible fine grain, imperfect white balance leaning warm,
handheld with a touch of motion blur at the edges, shallow but not extreme depth
of field. Documentary photography, not advertising. Off-center composition with
breathing room in the upper third. Real worn materials — scratched wood, chipped
ceramic, fingerprints on glass. Candid, unstyled, a little messy.
```

## 4. Negative prompt

```
perfect, flawless, pristine, symmetrical, glossy, plastic, 3D render, CGI,
hyperrealistic, ultra detailed, 8k, studio lighting, softbox, cinematic lighting,
oversaturated, HDR, lens flare, bokeh balls, floating UI elements, holograms,
fake app interface, readable text on screens, app screenshot, menu, price list,
watermark, stock photo look, smiling models looking at camera,
generic modern minimalist cafe
```

---

## 5. Set A — 1:1, predstavlja aplikaciju

Kvadratni format, fokus na proizvod i brend. Ekrani su tamni ili van kadra —
nigdje se ne prikazuje sadržaj menija.

### A1 · QR stalak kao proizvod

**Generiše:** čist product shot stalka na stolu kafića, bez ičega drugog u kadru.
**Koristi se za:** predstavljanje fizičkog dijela usluge, prvi post u seriji.
**Tekst ide:** desni gornji kvadrant. **Prazan kvadrat → pravi QR.**

```
A matte black acrylic table stand with a blank white square on its face, standing
alone on a scratched dark walnut cafe table. Nothing else in frame except a
single coffee ring stain and a few crumbs. Hard side light from a window at the
left, deep shadow falling to the right across the wood. Shot at table height,
very close, f/1.8, the back edge of the table dissolving into blur. Dust visible
on the top edge of the stand.
```

### A2 · Paket za kafić

**Generiše:** flat lay odozgo — stalci, naljepnice, kartica, traka na kraft papiru.
**Koristi se za:** "šta dobijaš kad se prijaviš", post o postavljanju.
**Tekst ide:** donja trećina. **Naljepnice → pravi logo.**

```
A flat lay from directly above of a small welcome kit spread on brown kraft
paper: three matte black table stands stacked slightly askew, a sheet of round
stickers in warm brown and tan tones, a folded card, and a roll of tape. The
arrangement is not perfectly aligned — one stand is turned, the sticker sheet
has one sticker already peeled off. Overcast daylight from a window, soft but
directional. Muted palette of deep espresso brown and warm tan.
```

### A3 · Telefon i kafa

**Generiše:** telefon licem nadolje pored fildžana i džezve, topla popodnevna
svjetlost. Aplikacija je prisutna a da se ne vidi.
**Koristi se za:** atmosferski post, "Carteo je tu, ne smeta".
**Tekst ide:** gornji lijevi kvadrant.

```
A smartphone lying face-down on a cafe table next to a fildžan of Bosnian coffee
and a small copper džezva. Late afternoon light rakes across the table from the
left, catching the copper. The phone's black back is scuffed. Shot from a low
seated angle, very shallow focus on the phone, the coffee slightly soft. Deep
shadows in the lower right, empty warm blur filling the upper left of the square.
```

### A4 · Trenutak postavljanja

**Generiše:** ruku koja spušta stalak na svježe obrisan sto, blagi motion blur.
**Koristi se za:** "postavljanje traje 5 minuta", onboarding poruka.
**Tekst ide:** gornji lijevi kvadrant.

```
A hand placing a small black QR stand onto a wooden cafe table, caught mid-motion
with slight blur on the fingers. Only the hand and forearm in frame, entering
from the right edge, sleeve rolled up. The table is otherwise empty and freshly
wiped, still slightly wet, catching the light. Shot from above at a 45 degree
angle, morning window light. Square crop with the top-left quadrant empty.
```

### A5 · Vlasnik za šankom

**Generiše:** vlasnika za poluzatvorenim laptopom u praznom kafiću ujutro, ekran
se ne vidi.
**Koristi se za:** obraćanje vlasniku, "upravljaj menijem sa šanka".
**Tekst ide:** desna strana.

```
A laptop half-closed on a worn wooden bar counter, seen from behind and to the
side so the screen is not visible. A man's hands rest on either side of it, one
holding a pen over an open notebook with handwritten numbers. A cold espresso
cup sits beside a stack of receipts. Empty cafe behind, chairs stacked on
tables, morning light through a large window. Desaturated, grainy, tired
atmosphere.
```

### A6 · Brend mrtva priroda

**Generiše:** tamnu, dramatičnu mrtvu prirodu strogo u brend paleti — zrna kafe,
džezva, kartica s praznim utisnutim kvadratom.
**Koristi se za:** profilni grid, brend post bez poruke o funkciji. Najjača slika
za estetiku feeda.
**Tekst ide:** desna polovina koja pada u crno.

```
A still life on dark textured stone: roasted coffee beans scattered loosely, a
small copper džezva on its side, and a matte black card with a blank debossed
square. The palette is strictly deep espresso brown and warm golden tan, nothing
else. Single hard light source from the upper left, dramatic falloff into
near-black on the right half of the square frame. Visible dust and a scratch on
the stone surface.
```

### A7 · Naljepnica na ulazu

**Generiše:** okruglu naljepnicu na staklenim vratima, snimljenu s ulice kroz
odsjaje i kapi kiše.
**Koristi se za:** "prepoznaj lokal koji ima Carteo", gradnja vidljivosti brenda.
**Tekst ide:** donji dio, preko sivog stakla.

```
A small circular sticker on the inside of a cafe's glass door, photographed from
the street through the glass at a slight angle. Reflections of the street and a
parked car distort across the surface. The sticker is warm tan on dark brown with
a blank white square in the middle. Rain spots on the glass. Overcast grey
daylight, low contrast, muted colours, visible grain.
```

### A8 · Konobar u smjeni

**Generiše:** telefon u džepu kecelje dok konobar prolazi pored šanka, motion blur.
**Koristi se za:** najava narudžbi i konobarskog panela.
**Tekst ide:** gornji lijevi tamni prostor.

```
A waiter's apron pocket with a phone tucked into it, screen dark, shot from
above as he walks past a bar counter. Motion blur across the lower half of the
frame from his stride. Only the torso and apron visible, no face. Warm evening
tungsten light, bottles glowing out of focus behind. Grainy, high ISO, slightly
soft. Square crop, subject in the lower right, empty dark space upper left.
```

---

## 6. Set B — 4:5 i 9:16, priča i problem

Vertikalni format za feed i stories. Ovdje se prodaje bol i objašnjava tok.

### B1 · Hero — šta je Carteo

**Generiše:** sto iz ugla gosta — fildžan, džezva, QR stalak, telefon s ugašenim
ekranom. **Ekran ostaje taman → screenshot menija.**

```
A small Bosnian cafe table photographed from a seated diner's point of view.
On the scratched dark wood table: a fildžan of Bosnian coffee beside a small
copper džezva, a glass of water, a lighter, and a simple matte black acrylic
stand holding a QR code. A smartphone lies face-up next to the cup, its screen
dark and off. Late afternoon light comes through a window on the left, uneven,
with the far side of the table falling into shadow. Background is a soft blur of
a worn cafe interior — wooden chairs, a radiator, a half-drawn curtain.
Empty space in the upper right for text.
```

### B2 · Problem — precrtane cijene

**Generiše:** oljuštenu laminiranu kartu s cijenama precrtanim hemijskom i
dopisanim rukom, mrlja od kafe, opekotina od cigarete.
**Ovo je najjača reklama u serijalu** — prodaje bol, ne funkciju.
**Overlay:** *"Cijene se mijenjaju. Meni ne mora."*

```
Close-up of a laminated paper cafe menu lying on a bar counter, photographed at
a steep angle. Several prices have been crossed out with blue ballpoint pen and
rewritten by hand next to them, some twice. The lamination is peeling at one
corner, there is a coffee ring stain on the edge and a small cigarette burn.
Overhead warm tungsten light, harsh and uneven. A pen rests on top of the menu.
Everything slightly out of focus except the crossed-out prices.
```

### B3 · Korak 1 — skeniranje

**Generiše:** kadar preko ramena, ruka podiže telefon prema QR stalku, bez lica.

```
Over-the-shoulder view of a young woman at a cafe table holding her phone up to
a QR code stand, mid-gesture, her arm partially cutting into the frame. Only her
hand and part of her forearm are visible — no face. The phone screen is dark and
angled away from the camera. On the table: two coffees, an ashtray, a set of
keys. Shot from behind and slightly above, the background out of focus. Evening,
mixed warm indoor light with cool blue coming from a window.
```

### B4 · Korak 2 — konobar prima narudžbu

**Generiše:** konobara za šankom koji gleda u telefon u ruci, blago zamućen pokret.

```
A waiter standing behind a wooden bar, looking down at a phone held low in one
hand, the other hand resting on the counter near a stack of saucers. He is
mid-motion, slightly blurred. The phone screen is dark. Behind him a shelf of
bottles catches uneven light. Shot from across the bar at chest height, a beer
tap in soft focus in the foreground corner of the frame. Warm indoor lighting,
late evening, some grain in the shadows. His face is partially turned away.
```

### B5 · Vlasnik mijenja cijenu

**Generiše:** vlasnika u praznom kafiću ujutro za laptopom, ekran nije vidljiv
kameri, umoran izraz.

```
A cafe owner in his forties sitting at a corner table with a laptop open in
front of him, one hand on the trackpad, a cold cup of coffee and a notebook with
handwritten numbers beside it. Morning light through a large window, the cafe
empty behind him with chairs still stacked on two tables. He is looking at the
screen, not the camera, shot from the side at eye level. The laptop screen is
not visible to the camera. Slightly desaturated, real skin texture, tired
expression.
```

### B6 · Prije / poslije

**Generiše:** flat lay odozgo — gomila štampanih menija lijevo, QR stalak i telefon
desno. **Overlay:** *"Prije / Poslije"*

```
A cafe table split by natural composition: on the left half, a thick stack of
printed paper menus tied with a rubber band, edges curled and worn. On the right
half, a single small QR stand and a phone lying flat. Shot directly from above,
flat lay, on a scratched wooden surface. Uneven daylight from one side casting a
soft shadow across the middle. The stack of menus is dusty. Nothing else in
frame.
```

### B7 · Atmosfera i društveni dokaz

**Generiše:** dvoje prijatelja na terasi, jedan pokazuje na telefon drugog, ljetnja
večer, kadar sa susjednog stola.

```
Two friends at an outdoor cafe terrace in a Bosnian town, one leaning over the
table pointing at the other's phone, both laughing but not at the camera. Shot
from a neighbouring table, partially obscured by a chair back in the foreground.
Summer evening, string lights out of focus behind them, plastic chairs, a
cobblestone street visible. Slightly grainy, phone screen dark. Candid street
photography feel, imperfect framing, one subject slightly cut off.
```

### B8 · Detalj stalka

**Generiše:** makro stalka, sve iza se rastapa u toplo zamućenje.
**Prazan kvadrat → pravi QR.**

```
Extreme close-up of a matte black QR code stand on a cafe table, the code itself
sharp, everything behind it dissolving into warm blur. A fildžan is just visible
at the edge of frame. Dust visible on the surface of the stand, a faint
fingerprint on its side. Shot at f/1.8 from table height, natural window light
from behind creating a rim of light along the top edge. Deep shadows.
```

---

## 7. Radni tok

| Korak | Šta |
|---|---|
| 1 | Prompt + odgovarajući stilski blok + negative prompt |
| 2 | **6–8 varijanti po promptu.** Prvi rezultat je gotovo uvijek najgeneričniji |
| 3 | U Photoshopu/Canvi zalijepiti **pravi screenshot** menija na tamne ekrane i **pravi QR** u prazne kvadrate |
| 4 | −5 saturacije + blagi film grain preko cijele slike |
| 5 | Tekst overlay u Poppinsu, u praznom kvadrantu koji prompt ostavlja |

**Format:** `square 1:1, 1024x1024` za Set A · `4:5` za feed i `9:16` za stories
kod Seta B.

**Grid feeda:** A1, A3, A6 idu zajedno kao jedan red — ista paleta, isti ton.

### Šta izbjegavati kod ljudi

| Problem | Rješenje u promptu |
|---|---|
| Lice gledano pravo u kameru (oči, zubi) | `no face`, `looking away`, `partially turned away` |
| Prsti i dlanovi u fokusu | ruka iz profila, djelimično van kadra, `mid-motion with slight blur` |
| Osmijeh prema objektivu | `laughing but not at the camera`, `candid` |

### Bolja opcija od AI-a

Najautentičniji rezultat nije generisanje nego **telefon**. U kafiću s kojim ide
pilot se za 15 minuta može snimiti 20 fotografija — sto, stalak, konobar, vlasnik
za laptopom. Besplatno, stvarno, i daje pravo lice lokala kao referencu. AI ostaje
za ono što se ne može snimiti: prije/poslije montaže, čisti flat layovi, brend
mrtva priroda.


attendance kod interna na profilu
by day sortiranje po drugim mjesecima
remote work sortiranje