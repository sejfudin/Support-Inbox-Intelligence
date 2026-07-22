const attendanceService = require('../services/attendanceService');

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

exports.getMyAttendance = async (req, res, next) => {
  try {
    const attendance = await attendanceService.getMyAttendance(req.user);
    res.json({ success: true, message: 'Attendance retrieved', data: { attendance } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const attendance = await attendanceService.checkIn(req.user, { ip: req.ip });
    res.json({ success: true, message: 'Checked in', data: { attendance } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.cancelCheckIn = async (req, res, next) => {
  try {
    const attendance = await attendanceService.cancelCheckIn(req.user);
    res.json({ success: true, message: 'Check-in cancelled', data: { attendance } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getRoster = async (req, res, next) => {
  try {
    const { month, roster } = await attendanceService.getRoster(req.user, req.query);
    res.json({ success: true, message: 'Roster retrieved', data: { month, roster } });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getInternAttendance = async (req, res, next) => {
  try {
    const attendance = await attendanceService.getInternAttendance(
      req.params.internProfileId,
      req.query.month
    );
    res.json({ success: true, message: 'Intern attendance retrieved', data: { attendance } });
  } catch (error) {
    handleError(res, error, next);
  }
};
