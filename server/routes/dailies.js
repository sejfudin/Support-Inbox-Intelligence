const express = require('express');
const router = express.Router();

const {
  getDaily,
  getDailyHistory,
  startDaily,
  addEntry,
  updateEntry,
  removeEntry,
} = require('../controllers/dailies');
const { protect } = require('../middleware/auth');

router.get('/history', protect, getDailyHistory);
router.get('/', protect, getDaily);
router.post('/', protect, startDaily);
router.post('/:id/entries', protect, addEntry);
router.patch('/:id/entries/:entryId', protect, updateEntry);
router.delete('/:id/entries/:entryId', protect, removeEntry);

module.exports = router;
