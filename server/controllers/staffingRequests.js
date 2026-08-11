const staffingRequestService = require('../services/staffingRequestService');

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
    const { request, duplicateOf } = await staffingRequestService.createStaffingRequest(
      req.user,
      req.body
    );
    res
      .status(201)
      .json({ success: true, message: 'Staffing request created', data: { request, duplicateOf } });
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

exports.cancelStaffingRequest = async (req, res, next) => {
  try {
    const request = await staffingRequestService.cancelStaffingRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Staffing request cancelled', data: request });
  } catch (error) {
    handleError(res, error, next);
  }
};
