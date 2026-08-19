const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { ROLES } = require('../constants/roles');
const { getSettings, updateSettings, resetSettings } = require('../controllers/absenceSettings');

// How many days an intern may ask for, per type. Admin-only in both directions:
// these numbers decide what everyone else is entitled to, and an intern reads the
// ones that apply to them from their own request list instead.
//
// Its own file rather than a `/settings` branch inside routes/absenceRequest.js
// — that router already owns `/:id` for decide and revoke, and a sibling literal
// segment there survives only as long as nobody reorders the file.
router.get('/', protect, requireRole(ROLES.ADMIN), getSettings);
router.put('/', protect, requireRole(ROLES.ADMIN), updateSettings);
router.delete('/', protect, requireRole(ROLES.ADMIN), resetSettings);

module.exports = router;
