# Database scripts — custom ticket statuses rollout

Run these from the `server/` directory against the target `MONGODB_URI` in `.env`.

## Order of operations (production)

1. **Backup** Atlas cluster (snapshot or `mongodump`).
2. **Maintenance window** — stop or read-only the app.
3. `node scripts/auditTicketStatuses.js` — baseline report (read-only).
4. `node scripts/migrateTicketStatuses.js` — rename `taskstatuses` collection if needed; seed `TicketStatus` for workspaces with none.
5. `node scripts/reconcileTicketStatuses.js --dry-run` — review planned ticket/integration fixes.
6. `node scripts/reconcileTicketStatuses.js --execute` — apply slug mapping, lifecycle backfill, GitHub target repair.
7. `node scripts/auditTicketStatuses.js` — confirm orphans and lifecycle gaps are resolved.
8. Deploy application code and smoke-test (see `server/tests/statusSlugAliases.test.js`).

## Scripts

| Script                       | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `auditTicketStatuses.js`     | Read-only per-workspace health report                       |
| `migrateTicketStatuses.js`   | Collection rename + seed default statuses                   |
| `reconcileTicketStatuses.js` | Fix ticket slugs, `doneAt` / `inProgressAt`, GitHub targets |

### Flags

- `auditTicketStatuses.js --json` — print JSON to stdout
- `reconcileTicketStatuses.js --dry-run` (default) — no writes
- `reconcileTicketStatuses.js --execute` — apply changes

Outputs are also written to `scripts/last-status-audit.json` and `scripts/last-status-reconcile.json`.
