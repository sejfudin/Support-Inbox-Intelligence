const internshipTypeService = require('../services/internshipTypeService');
const { ROLES } = require('../constants/roles');

exports.getInternshipTypes = async (req, res, next) => {
  try {
    const includeInactive =
      req.user?.role === ROLES.ADMIN && req.query.includeInactive === 'true';
    const types = await internshipTypeService.getAllInternshipTypes({ includeInactive });
    res.json(types);
  } catch (error) {
    next(error);
  }
};

exports.createInternshipType = async (req, res, next) => {
  try {
    const type = await internshipTypeService.createInternshipType(req.body);
    res.status(201).json(type);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An internship type with this slug already exists' });
    }
    next(error);
  }
};

exports.updateInternshipType = async (req, res, next) => {
  try {
    const type = await internshipTypeService.updateInternshipType(req.params.id, req.body);
    res.json(type);
  } catch (error) {
    if (error.message === 'Internship type not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};
