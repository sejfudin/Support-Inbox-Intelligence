const internService = require('../services/internService');
const internCvService = require('../services/internCvService');
const mentorCommentService = require('../services/mentorCommentService');
const evaluationService = require('../services/evaluationService');
const readinessFlagService = require('../services/readinessFlagService');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  next(error);
};

exports.listInterns = async (req, res, next) => {
  try {
    const result = await internService.listInterns(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getProgrammeStats = async (req, res, next) => {
  try {
    const stats = await internService.getProgrammeStats(req.user);
    res.json({ stats });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getIntern = async (req, res, next) => {
  try {
    const intern = await internService.getInternByUserId(req.user, req.params.userId);
    res.json({ intern });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getMyProfile = async (req, res, next) => {
  try {
    const intern = await internService.getMyInternProfile(req.user);
    res.json({ intern });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateMyTechnologies = async (req, res, next) => {
  try {
    const intern = await internService.updateSelfTechnologies(req.user, req.body.technologyIds);
    res.json({ intern });
  } catch (error) {
    if (error.message === 'Intern profile not found') {
      return res.status(404).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.updateIntern = async (req, res, next) => {
  try {
    const intern = await internService.updateInternByMentor(req.user, req.params.userId, req.body);
    res.json({ intern });
  } catch (error) {
    if (error.message === 'Intern profile not found' || error.message === 'Invalid status') {
      return res.status(400).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.updateDocumentationLinks = async (req, res, next) => {
  try {
    const intern = await internService.updateDocumentationLinks(
      req.user,
      req.params.userId,
      req.body.links
    );
    res.json({ intern });
  } catch (error) {
    if (
      error.message === 'Intern profile not found' ||
      error.message === 'Documentation links must be an array' ||
      error.message?.startsWith('Documentation link') ||
      error.message?.startsWith('A maximum of')
    ) {
      return res.status(400).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.uploadMyCv = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'CV file is required' });
    const result = await internCvService.uploadInternCv({
      userId: req.user._id,
      file: req.file,
    });
    res.json(result);
  } catch (error) {
    if (error.message === 'Intern profile not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.deleteMyCv = async (req, res, next) => {
  try {
    const result = await internCvService.deleteInternCv(req.user._id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Intern profile not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

exports.listComments = async (req, res, next) => {
  try {
    const comments = await mentorCommentService.listComments(req.user, req.params.userId);
    res.json({ comments });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createComment = async (req, res, next) => {
  try {
    const comment = await mentorCommentService.createComment(req.user, req.params.userId, req.body);
    res.status(201).json({ comment });
  } catch (error) {
    if (
      error.message === 'Comment content is required' ||
      error.message?.includes('visibility recipients')
    ) {
      return res.status(400).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.listEvaluations = async (req, res, next) => {
  try {
    const evaluations = await evaluationService.listEvaluations(req.user, req.params.userId);
    res.json({ evaluations });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createEvaluation = async (req, res, next) => {
  try {
    const evaluation = await evaluationService.createEvaluation(
      req.user,
      req.params.userId,
      req.body
    );
    res.status(201).json({ evaluation });
  } catch (error) {
    if (error.message?.includes('Score for') || error.message === 'Evaluation period is required') {
      return res.status(400).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.listReadiness = async (req, res, next) => {
  try {
    const flags = await readinessFlagService.listReadinessFlags(req.user, req.params.userId);
    res.json({ flags });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.upsertReadiness = async (req, res, next) => {
  try {
    const flag = await readinessFlagService.upsertReadinessFlag(
      req.user,
      req.params.userId,
      req.body
    );
    res.json({ flag });
  } catch (error) {
    if (
      error.message === 'Technology is required' ||
      error.message === 'Invalid readiness level' ||
      error.message === 'Invalid technology'
    ) {
      return res.status(400).json({ message: error.message });
    }
    handleError(res, error, next);
  }
};

exports.listCommentViewers = async (req, res, next) => {
  try {
    const users = await User.find({
      status: 'active',
      role: { $in: [ROLES.ADMIN, ROLES.MENTOR, ROLES.LEADERSHIP] },
    })
      .select('fullname email role')
      .sort({ fullname: 1 })
      .lean();

    res.json({
      users: users.map((u) => ({ ...u, id: u._id })),
    });
  } catch (error) {
    next(error);
  }
};
