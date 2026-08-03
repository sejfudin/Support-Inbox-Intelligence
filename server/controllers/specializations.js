const specializationService = require('../services/specializationService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  next(error);
};

exports.listSpecializations = async (req, res, next) => {
  try {
    const result = await specializationService.listSpecializations(req.user, req.query);
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

exports.reassignSpecialization = async (req, res, next) => {
  try {
    const specialization = await specializationService.reassignSpecialization(
      req.user,
      req.params.internUserId
    );
    res.json({ specialization });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.changeSpecializationMentor = async (req, res, next) => {
  try {
    const specialization = await specializationService.changeSpecializationMentor(
      req.user,
      req.params.internUserId,
      req.body.mentorId
    );
    res.json({ specialization });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.clearSpecialization = async (req, res, next) => {
  try {
    const specialization = await specializationService.clearSpecialization(
      req.user,
      req.params.internUserId
    );
    res.json({ specialization });
  } catch (error) {
    handleError(res, error, next);
  }
};
