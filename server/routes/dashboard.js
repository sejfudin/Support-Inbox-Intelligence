const express = require('express');
const router = express.Router();

const {
  getInternDashboard,
  getInternProgress,
  summarizeMyStandup,
} = require('../controllers/internDashboard');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');

/**
 * The signed-in intern's own dashboard. Read-only, intern-only, and scoped
 * entirely from the authenticated user — it takes no workspace or intern
 * parameter at all, unlike the admin board's `GET /api/admin/dashboard?workspaceId=`.
 * That is the point: this payload includes the caller's own recommendations and
 * evaluations, which no other role reads through here.
 */
router.get('/me', protect, requireRole(ROLES.INTERN), getInternDashboard);

/**
 * "My progress" — everything the programme records about the caller: their
 * evaluations (scores AND the mentor's written notes), their readiness by
 * technology and by position, and every recommendation they have been part of.
 *
 * Read-only and parameterless for the same reason as the board above, and more
 * so: this is the widest self-read on the platform, so the absence of any intern
 * or workspace override is the whole authorization story. The admin surfaces for
 * the same data (`/api/interns/:userId/evaluations`, `/:userId/readiness`,
 * `/api/recommendations`) stay `requireRole(ADMIN)` and are where writes live —
 * nothing here writes, and no other role may read through here.
 */
router.get('/me/progress', protect, requireRole(ROLES.INTERN), getInternProgress);

/**
 * Summarise the caller's own standup note for today, for the dashboard card.
 * Also parameterless, and a POST because it can spend an AI call and writes the
 * result back onto the entry — though it is idempotent: a note whose cached
 * summary still matches returns it without calling the provider.
 */
router.post('/me/standup-summary', protect, requireRole(ROLES.INTERN), summarizeMyStandup);

module.exports = router;
