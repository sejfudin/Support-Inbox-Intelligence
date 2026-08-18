const recommendationService = require('../services/recommendationService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

exports.listRecommendations = async (req, res, next) => {
  try {
    const result = await recommendationService.listRecommendations(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getRecommendation = async (req, res, next) => {
  try {
    const recommendation = await recommendationService.getRecommendation(req.user, req.params.id);
    res.json({ recommendation });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createRecommendation = async (req, res, next) => {
  try {
    const recommendation = await recommendationService.createRecommendation(req.user, req.body);
    res.status(201).json({ recommendation });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateRecommendation = async (req, res, next) => {
  try {
    const recommendation = await recommendationService.updateRecommendation(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ recommendation });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.deleteRecommendation = async (req, res, next) => {
  try {
    const recommendation = await recommendationService.deleteRecommendation(
      req.user,
      req.params.id
    );
    res.json({ recommendation });
  } catch (error) {
    handleError(res, error, next);
  }
};
