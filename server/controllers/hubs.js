const hubService = require('../services/hubService');
const { ROLES } = require('../constants/roles');

exports.getHubs = async (req, res, next) => {
  try {
    const includeInactive = req.user?.role === ROLES.ADMIN && req.query.includeInactive === 'true';
    const hubs = await hubService.getAllHubs({ includeInactive });
    res.json(hubs);
  } catch (error) {
    next(error);
  }
};

exports.createHub = async (req, res, next) => {
  try {
    const hub = await hubService.createHub(req.body);
    res.status(201).json(hub);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A hub with this name already exists' });
    }
    next(error);
  }
};

exports.updateHub = async (req, res, next) => {
  try {
    const hub = await hubService.updateHub(req.params.id, req.body);
    res.json(hub);
  } catch (error) {
    if (error.message === 'Hub not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A hub with this name already exists' });
    }
    next(error);
  }
};
