const staffingRequestService = require('../services/staffingRequestService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.data ? { data: error.data } : {}),
    });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  next(error);
};

exports.listStaffingRequests = async (req, res, next) => {
  try {
    const requests = await staffingRequestService.listStaffingRequests(req.user, req.query);
    res.json({ success: true, message: 'Staffing requests fetched', data: requests });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getStaffingRequest = async (req, res, next) => {
  try {
    const request = await staffingRequestService.getStaffingRequest(req.user, req.params.id);
    res.json({ success: true, message: 'Staffing request fetched', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createStaffingRequest = async (req, res, next) => {
  try {
    const request = await staffingRequestService.createStaffingRequest(req.user, req.body);
    res.status(201).json({ success: true, message: 'Staffing request created', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.updateStaffingRequest = async (req, res, next) => {
  try {
    const request = await staffingRequestService.updateStaffingRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Staffing request updated', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.resolveStaffingRequestProject = async (req, res, next) => {
  try {
    const request = await staffingRequestService.resolveStaffingRequestProject(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Project linked', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.resolveStaffingRequestProjectByCreating = async (req, res, next) => {
  try {
    const request = await staffingRequestService.resolveStaffingRequestProjectByCreating(
      req.user,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: 'Project created and linked', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.listPutForwardCandidates = async (req, res, next) => {
  try {
    const data = await staffingRequestService.listPutForwardCandidates(
      req.user,
      req.params.id,
      req.params.positionId
    );
    res.json({ success: true, message: 'Candidates fetched', data });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.putInternsForward = async (req, res, next) => {
  try {
    const request = await staffingRequestService.putInternsForward(
      req.user,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, message: 'Interns put forward', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};

const CLOSE_MESSAGES = {
  fulfilled: 'Staffing request closed as fulfilled',
  declined: 'Staffing request declined',
  cancelled: 'Staffing request cancelled',
};

exports.closeStaffingRequest = async (req, res, next) => {
  try {
    const request = await staffingRequestService.closeStaffingRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      message: CLOSE_MESSAGES[req.body?.reason] ?? 'Staffing request closed',
      data: request,
    });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getStaffingRequestNews = async (req, res, next) => {
  try {
    const news = await staffingRequestService.getStaffingRequestNews(req.user);
    res.json({ success: true, message: 'Staffing request news fetched', data: news });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.markStaffingRequestsSeen = async (req, res, next) => {
  try {
    const result = await staffingRequestService.markStaffingRequestsSeen(req.user);
    res.json({ success: true, message: 'Staffing requests marked as seen', data: result });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getStaffingRequestHistory = async (req, res, next) => {
  try {
    const history = await staffingRequestService.getStaffingRequestHistory(req.user, req.params.id);
    res.json({ success: true, message: 'Staffing request history fetched', data: history });
  } catch (error) {
    handleError(res, error, next);
  }
};
