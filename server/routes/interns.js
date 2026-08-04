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
  updateMyPosition,
  updateMySecondaryPosition,
  updateIntern,
  updateDocumentationLinks,
  updateInternalCv,
  uploadMyCv,
  deleteMyCv,
  listComments,
  createComment,
  listEvaluations,
  createEvaluation,
  listReadiness,
  upsertReadiness,
  listCommentViewers,
  getMyReadiness,
} = require('../controllers/interns');

router.get('/', protect, listInterns);
router.get('/me', protect, getMyProfile);
router.patch('/me/technologies', protect, updateMyTechnologies);
router.patch('/me/position', protect, updateMyPosition);
router.patch('/me/secondary-position', protect, updateMySecondaryPosition);
router.get('/me/readiness', protect, getMyReadiness);
router.post('/me/cv', protect, uploadCv, uploadMyCv);
router.delete('/me/cv', protect, deleteMyCv);

router.get('/comment-viewers', protect, listCommentViewers);
router.get('/stats', protect, getProgrammeStats);

router.get('/:userId', protect, getIntern);
router.patch('/:userId', protect, updateIntern);
router.put('/:userId/documentation-links', protect, updateDocumentationLinks);
router.put('/:userId/internal-cv', protect, updateInternalCv);

router.get('/:userId/comments', protect, listComments);
router.post('/:userId/comments', protect, createComment);

router.get('/:userId/evaluations', protect, listEvaluations);
router.post('/:userId/evaluations', protect, createEvaluation);

router.get('/:userId/readiness', protect, listReadiness);
router.put('/:userId/readiness', protect, upsertReadiness);

module.exports = router;
