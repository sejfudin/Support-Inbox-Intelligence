---
name: verify
description: How to launch and drive this app to verify a change end-to-end (ports, demo logins, API drive recipe).
---

# Verifying changes in Support-Inbox-Intelligence

## Launch

Two processes, both from repo root (background them):

```bash
cd server && npm run dev      # API + Socket.IO on :4000 (needs server/.env — MONGODB_URI + SUPABASE_URL are hard-required, module throws without them)
cd frontend && npm run dev    # Vite on :5173 — see the CORS note below before changing the port
```

`frontend/.env` sets `VITE_API_BASE_URL=http://localhost:4000/api` — the SPA calls the API
directly, there is no Vite proxy.

**The frontend must run on the port in `server/.env*` `CLIENT_URL` (currently `:5173`).** The API
sets `cors({ origin: process.env.CLIENT_URL })`, so a UI served from any other port gets every
request blocked at preflight and the app bounces straight to `/login` — which looks like an auth
bug, not a CORS one. If `:5173` is taken by another project, either stop that process or change
`CLIENT_URL` and restart the API; don't just pick a free port.

## Demo logins

Which accounts exist depends on which seeder last ran (never run seeders against non-local DBs):

- **`seed:demo` (current default dataset) — reach for these first, all password `password`:**
  `admin@symphony.is`, `mentor@symphony.is`, `intern@symphony.is`, `leadership@symphony.is`.
  Plus 20 interns at `firstname.lastname@symphony.is` and two mentors
  (`boris.petrovic@`, `natasa.ilic@symphony.is`), same password.
- `admin@test.com` / `admin123`, `mentor@test.com` / `mentor123` (base `seed`)
- `leadership@symphony.is`, `mentor.sarajevo@symphony.is`, `intern.*@symphony.is` … / `password` (`seed:test`)
- A mixed DB is common — if a login fails, list actual users:
  `node -e "require('dotenv').config(); ..."` in `server/` with Mongoose (`User.find({role:'mentor'}).select('email')`).

## Driving the API surface

```bash
TOKEN=$(curl -s http://localhost:4000/api/auth/login -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@symphony.is","password":"password"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))")
curl -s "http://localhost:4000/api/attendance" -H "Authorization: Bearer $TOKEN"
```

Auth is Bearer token (`accessToken` from login response — it is at the **top level**, not inside
the `{ success, message, data }` envelope), not cookies. Failed logins return an HTML error page,
not JSON — guard your parsing.

## Gotchas

- `GET /interns/stats` aggregates InternProfile/Recommendation collections directly; `GET /interns`
  joins through `User` with `role: 'intern'` — totals can legitimately differ (orphaned profiles,
  KPI counts recommendations not distinct interns).
- **The what's-new tour no longer covers the screen.** It used to open itself on the first load
  after a `TOUR_VERSION` bump and swallow every click until the script was walked to the end, which
  stalled browser passes on any account that had not seen the current version. Nothing opens it
  now — only a click on the sidebar's "What's new" button — so a run meets it only if it clicks it.
  What a fresh account *does* show is the signal: that button glowing, and a **NEW** pill beside
  the nav rows the release touched. Both are expected, and both go quiet once the tour has been
  read (`PATCH /api/users/me/whats-new-seen` with the current `TOUR_VERSION`, or walking it to the
  end). `TOUR_ENABLED` in `frontend/src/components/onboarding/whatsNewSteps.js` still turns the
  whole thing off in one line if a screenshot needs the footer quiet.
- GUI verification needs a browser (Playwright MCP) — confirm the user allows it in the session
  before driving; otherwise verify the API surface and flag the click-through as manual.
