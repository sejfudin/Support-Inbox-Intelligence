const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadCv } = require('../middleware/upload');
const {
  listInterns,
  getProgrammeStats,
  getIntern,
  getMyProfile,
  updateMyTechnologies,
  updateIntern,
  uploadMyCv,
  deleteMyCv,
  listComments,
  createComment,
  listEvaluations,
  createEvaluation,
  listReadiness,
  upsertReadiness,
  listCommentViewers,
} = require('../controllers/interns');

router.get('/', protect, listInterns);
router.get('/me', protect, getMyProfile);
router.patch('/me/technologies', protect, updateMyTechnologies);
router.post('/me/cv', protect, uploadCv, uploadMyCv);
router.delete('/me/cv', protect, deleteMyCv);

router.get('/comment-viewers', protect, listCommentViewers);
router.get('/stats', protect, getProgrammeStats);

router.get('/:userId', protect, getIntern);
router.patch('/:userId', protect, updateIntern);

router.get('/:userId/comments', protect, listComments);
router.post('/:userId/comments', protect, createComment);

router.get('/:userId/evaluations', protect, listEvaluations);
router.post('/:userId/evaluations', protect, createEvaluation);

router.get('/:userId/readiness', protect, listReadiness);
router.put('/:userId/readiness', protect, upsertReadiness);

module.exports = router;
