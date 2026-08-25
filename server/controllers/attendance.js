const attendanceService = require('../services/attendanceService');
const { handleControllerError: handleError } = require('../helpers/controllerError');

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
    // Spread the service result rather than picking fields: `nonWorkingDays` was
    // being dropped here while the page read `data.nonWorkingDays`, so the admin's
    // "By day" tab counted every public holiday as a cohort-wide absence.
    const roster = await attendanceService.getRoster(req.user, req.query);
    res.json({ success: true, message: 'Roster retrieved', data: roster });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getToday = async (req, res, next) => {
  try {
    const today = await attendanceService.getTodayAttendance();
    res.json({ success: true, message: "Today's attendance retrieved", data: today });
  } catch (error) {
    handleError(res, error, next);
  }
};

exports.getInternAttendance = async (req, res, next) => {
  try {
    const attendance = await attendanceService.getInternAttendance(
      req.user,
      req.params.internProfileId,
      req.query.month
    );
    res.json({ success: true, message: 'Intern attendance retrieved', data: { attendance } });
  } catch (error) {
    handleError(res, error, next);
  }
};
