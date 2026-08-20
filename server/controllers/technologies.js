const technologyService = require('../services/technologyService');
const { ROLES } = require('../constants/roles');

exports.getTechnologies = async (req, res, next) => {
  try {
    const includeInactive = req.user?.role === ROLES.ADMIN && req.query.includeInactive === 'true';
    const technologies = await technologyService.getAllTechnologies({ includeInactive });
    res.json(technologies);
  } catch (error) {
    next(error);
  }
};

exports.createTechnology = async (req, res, next) => {
  try {
    const technology = await technologyService.createTechnology(req.body);
    res.status(201).json(technology);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A technology with this slug already exists' });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

exports.updateTechnology = async (req, res, next) => {
  try {
    const technology = await technologyService.updateTechnology(req.params.id, req.body);
    res.json(technology);
  } catch (error) {
    if (error.message === 'Technology not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};
