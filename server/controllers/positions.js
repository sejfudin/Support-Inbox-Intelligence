const positionService = require('../services/positionService');
const { ROLES } = require('../constants/roles');

exports.getPositions = async (req, res, next) => {
  try {
    const includeInactive = req.user?.role === ROLES.ADMIN && req.query.includeInactive === 'true';
    const positions = await positionService.getAllPositions({ includeInactive });
    res.json(positions);
  } catch (error) {
    next(error);
  }
};

exports.createPosition = async (req, res, next) => {
  try {
    const position = await positionService.createPosition(req.body);
    res.status(201).json(position);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A position with this slug already exists' });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

exports.updatePosition = async (req, res, next) => {
  try {
    const position = await positionService.updatePosition(req.params.id, req.body);
    res.json(position);
  } catch (error) {
    if (error.message === 'Position not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};
