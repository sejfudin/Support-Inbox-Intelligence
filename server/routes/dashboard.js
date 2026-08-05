const express = require('express');
const router = express.Router();

const { getInternDashboard, summarizeMyStandup } = require('../controllers/internDashboard');
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
 * Summarise the caller's own standup note for today, for the dashboard card.
 * Also parameterless, and a POST because it can spend an AI call and writes the
 * result back onto the entry — though it is idempotent: a note whose cached
 * summary still matches returns it without calling the provider.
 */
router.post('/me/standup-summary', protect, requireRole(ROLES.INTERN), summarizeMyStandup);

module.exports = router;
