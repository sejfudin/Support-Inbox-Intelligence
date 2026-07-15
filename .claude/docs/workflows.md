# Workflows

## Prerequisites

- Node.js >= 18, npm.
- MongoDB instance (local or cloud) — `MONGODB_URI`.
- Supabase project + Storage buckets — **required**, server throws on startup without it.
- Optional: Groq API key (AI), GitHub App (PR linking).

Config lives in `server/.env`. Full variable list in `README.md` ("Environment variables").

## Install

```bash
cd server   && npm install
cd frontend && npm install
```

## Run (two terminals)

```bash
# server/
npm run dev        # nodemon index.js  (API + Socket.IO, default :4000)

# frontend/
npm run dev        # Vite dev server, default http://localhost:5173
```

In production, `node index.js` in `server/` also serves the built `frontend/dist` with SPA
fallback — single process hosts API + UI.

## Build

```bash
# frontend/
npm run build      # -> dist/
npm run preview    # serve built assets
```

## Format

```bash
npm run format       # write   (run in the package you changed)
npm run format:check # check
```

## Seeding — DANGEROUS

`npm run seed` **deletes all collections** then reseeds. Prompts for `wipe` confirmation.
Never run against a non-local database.

```bash
# server/
npm run seed        # destructive reset + demo workspace + admin@test.com / mentor@test.com
npm run seed:test   # richer dataset (Symphony staff + interns, password: "password")
npm run seed:positions
npm run backfill:intern-positions
npm run cleanup:invitations
```

Demo accounts (after seeding): full table in `README.md` ("Demo accounts").
- `admin@test.com` / `admin123`, `mentor@test.com` / `mentor123` (from `seed`).
- `*@symphony.is` accounts / `password` (from `seed:test`).

## Verifying a change

No test suite exists. To confirm a change works, drive the real app:
- Use `/run` to launch, `/verify` to exercise the affected flow end-to-end.
- Playwright MCP browser tools are permitted for UI verification.
- For API-only changes, hit the endpoint and check the `{ success, message, data }` response
  and the DB state.
