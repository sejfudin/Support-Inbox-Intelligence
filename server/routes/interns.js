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
  getCvSummary,
  generateCvSummary,
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

// Admin/mentor only, enforced in the service by `assertInternAccess` — the same
// rule that guards the profile and the CV file. Deliberately not offered to the
// intern for their own profile: it is a reader's aid for whoever is assessing
// them, and handing someone a machine's description of their own CV invites it
// to be read as feedback, which it is explicitly not (see prompts/internCvPrompts).
router.get('/:userId/cv-summary', protect, getCvSummary);
router.post('/:userId/cv-summary', protect, generateCvSummary);

router.get('/:userId/comments', protect, listComments);
router.post('/:userId/comments', protect, createComment);

router.get('/:userId/evaluations', protect, listEvaluations);
router.post('/:userId/evaluations', protect, createEvaluation);

router.get('/:userId/readiness', protect, listReadiness);
router.put('/:userId/readiness', protect, upsertReadiness);

module.exports = router;
