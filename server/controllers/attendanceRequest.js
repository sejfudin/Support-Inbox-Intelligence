const attendanceRequestService = require('../services/attendanceRequestService');

const handleError = (res, error, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  next(error);
};

exports.getMyRequests = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.listMyRequests(req.user);
    res.json({ success: true, message: 'Requests retrieved', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createMyRequest = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.createMyRequest(req.user, req.body);
    res.status(201).json({ success: true, message: 'Request sent', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.cancelMyRequest = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.cancelMyRequest(
      req.user,
      req.params.id
    );
    res.json({ success: true, message: 'Request withdrawn', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.listRequests(req.user, req.query);
    res.json({ success: true, message: 'Requests retrieved', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.decideRequest = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.decideRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Decision recorded', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.revokeRequest = async (req, res, next) => {
  try {
    const attendanceRequests = await attendanceRequestService.revokeRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Approval revoked', data: { attendanceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};
