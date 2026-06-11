const recommendationService = require('../services/recommendationService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(', ');
    return res.status(400).json({ message });
  }

  next(error);
};

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
