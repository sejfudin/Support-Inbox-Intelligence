const positionService = require('../services/positionService');

exports.getPositions = async (req, res, next) => {
  try {
    const positions = await positionService.getAllPositions();
    res.json(positions);
  } catch (error) {
    next(error);
  }
};
