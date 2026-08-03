const specializationService = require('../services/specializationService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  next(error);
};

exports.listSpecializedCandidates = async (req, res, next) => {
  try {
    const result = await specializationService.listSpecializedCandidates(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.listUnspecializedCandidates = async (req, res, next) => {
  try {
    const candidates = await specializationService.listUnspecializedCandidates(req.user);
    res.json({ candidates });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.assignSpecialization = async (req, res, next) => {
  try {
    const specialization = await specializationService.assignSpecialization(req.user, req.body);
    res.status(201).json({ specialization });
  } catch (error) {
    handleError(res, error, next);
  }
};
