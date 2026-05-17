# Database scripts — custom ticket statuses rollout

Run these from the `server/` directory. **`MONGODB_URI` in `server/.env` must point at the database you intend to change** (test clone or production).

## Fresh test database (prod dump → test Atlas)

Starting point: production data restored with string `ticket.status` values (e.g. `mongorestore … ./atlas-prod-dump/test`).

1. Set `server/.env` → test cluster URI (database name `test` or whatever you restored).
2. **Do not start the API** during migration (or use a maintenance window on that DB).
3. Run the pipeline below (steps 3–9).
4. **Then** start the app (code expects `ticket.status` as ObjectId + populated `status`).

You do **not** need `restoreTicketStatusLinks.js` on a fresh dump — only after a bad `linkTicketStatusIds.js` run.

## Order of operations (production or test)

1. **Backup** Atlas cluster (snapshot or `mongodump`).
2. **Maintenance window** — stop the app against that database.
3. `node scripts/auditTicketStatuses.js` — baseline (read-only). Before link, many tickets may show as `string_status` in the report; that is expected.
4. `node scripts/migrateTicketStatuses.js` — rename `taskstatuses` → `ticketstatuses` if needed; seed `TicketStatus` for workspaces with none.
5. `node scripts/reconcileTicketStatuses.js --dry-run` — review slug + lifecycle fixes.
6. `node scripts/reconcileTicketStatuses.js --execute` — apply (writes string slugs via native `tickets` collection).
7. `node scripts/linkTicketStatusIds.js --dry-run` — review string → ObjectId mapping. **Samples must show real `from` slugs (e.g. `"done"`, `"in progress"`), not `"from": ""`.**
8. `node scripts/linkTicketStatusIds.js --execute` — link tickets to `TicketStatus._id`.
9. `node scripts/verifyTicketStatusLinks.js` — must exit **0**.
10. Deploy / start application code (ObjectId model + populate).
11. `node scripts/migrateIntegrationStatusIds.js --dry-run` then `--execute` — map GitHub automation slug settings to `TicketStatus` ObjectIds.
12. `node scripts/auditTicketStatuses.js` — confirm no orphans / lifecycle gaps.
13. Bring app online.

### If link already ran and every ticket became "To do"

```bash
node scripts/restoreTicketStatusLinks.js --dry-run
node scripts/restoreTicketStatusLinks.js --execute
node scripts/verifyTicketStatusLinks.js
node scripts/auditTicketStatuses.js
```

Prefer an Atlas snapshot restore when available.

## Copy production → test (mongodump)

### Dump production

```bash
mongodump --uri="mongodb+srv://USER:PASS@prod-cluster.mongodb.net/PROD_DB" --out=./atlas-prod-dump
```

### Restore into test (overwrites test data)

```bash
mongorestore --uri="mongodb+srv://USER:PASS@test-cluster.mongodb.net/test" --drop ./atlas-prod-dump
```

## Scripts

| Script                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `auditTicketStatuses.js`      | Read-only per-workspace health report                           |
| `migrateTicketStatuses.js`    | Collection rename + seed default statuses                       |
| `reconcileTicketStatuses.js`  | Fix ticket slugs, `doneAt` / `inProgressAt`, GitHub targets     |
| `linkTicketStatusIds.js`      | Convert slug strings → ObjectIds (native `tickets` collection)  |
| `verifyTicketStatusLinks.js`  | Post-link verification (exits 1 if any issues)                  |
| `restoreTicketStatusLinks.js` | Repair bad ObjectId links (history + lifecycle) — recovery only |

### Flags

- `auditTicketStatuses.js --json` — print JSON to stdout
- `reconcileTicketStatuses.js --dry-run` (default) / `--execute`
- `linkTicketStatusIds.js --dry-run` (default) / `--execute`
- `verifyTicketStatusLinks.js --json` — print JSON to stdout
- `restoreTicketStatusLinks.js --dry-run` (default) / `--execute`

Outputs: `scripts/last-status-audit.json`, `last-status-reconcile.json`, `last-status-link.json`, `last-status-restore.json`.
