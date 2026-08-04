const projectService = require('../services/projectService');
const { ROLES } = require('../constants/roles');

exports.getProjects = async (req, res, next) => {
  try {
    const includeAll = req.user?.role === ROLES.ADMIN && req.query.includeAll === 'true';
    const projects = await projectService.getAllProjects({
      status: req.query.status,
      includeAll,
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    res.json({ success: true, message: 'Project fetched', data: project });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getProjectsOverview = async (req, res, next) => {
  try {
    const overview = await projectService.getProjectsOverview(req.user);
    res.json({ success: true, message: 'Projects overview fetched', data: overview });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getProjectOverview = async (req, res, next) => {
  try {
    const overview = await projectService.getProjectOverview(req.params.id, req.user);
    res.json({ success: true, message: 'Project overview fetched', data: overview });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A project with this name already exists' });
    }
    if (
      error.message === 'Project name is required' ||
      error.message === 'This project name is reserved' ||
      error.message === 'One or more technologies are invalid'
    ) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json(project);
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message === 'This project cannot be edited' ||
      error.message === 'Invalid project status' ||
      error.message === 'This project name is reserved' ||
      error.message === 'One or more technologies are invalid'
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A project with this name already exists' });
    }
    next(error);
  }
};
