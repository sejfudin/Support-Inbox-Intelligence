const absenceRequestService = require('../services/absenceRequestService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

exports.getMyRequests = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.listMyRequests(req.user);
    res.json({ success: true, message: 'Requests retrieved', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.createMyRequest = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.createMyRequest(req.user, req.body);
    res.status(201).json({ success: true, message: 'Request sent', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.cancelMyRequest = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.cancelMyRequest(req.user, req.params.id);
    res.json({ success: true, message: 'Request withdrawn', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.listRequests(req.user, req.query);
    res.json({ success: true, message: 'Requests retrieved', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.decideRequest = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.decideRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Decision recorded', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.revokeRequest = async (req, res, next) => {
  try {
    const absenceRequests = await absenceRequestService.revokeRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.json({ success: true, message: 'Approval revoked', data: { absenceRequests } });
  } catch (error) {
    handleError(res, error, next);
  }
};
