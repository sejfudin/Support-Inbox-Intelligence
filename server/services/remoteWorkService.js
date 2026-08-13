const RemoteWorkRequest = require('../models/RemoteWorkRequest');
const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const { officeDateKey } = require('../helpers/attendanceTime');
const { loadNonWorkingDays } = require('../helpers/attendanceStats');
const {
  createRequestRefusal,
  requestDayRefusal,
  normaliseDates,
} = require('../helpers/remoteWorkRules');
const { httpError } = require('../helpers/httpError');
const { loadMyProfile } = require('./attendanceService');

const { PENDING, APPROVED, REJECTED, CANCELLED, REVOKED, LIVE_STATUSES, MAX_DAYS_PER_REQUEST } =
  RemoteWorkRequest;
const { REMOTE } = Attendance;

/**
 * Remote-work requests: an intern asks for one day, an admin decides it, and an
 * approval writes the `Attendance` row itself.
 *
 * The rules live in `helpers/remoteWorkRules.js` as pure functions so they are
 * unit-tested; this module is the Mongo half — load the context those rules need,
 * apply the verdict, keep the attendance row in step.
 */

const toRequestSummary = (request) => ({
  id: request._id,
  dates: request.dates || [],
  status: request.status,
  reason: request.reason || '',
  decisionNote: request.decisionNote || '',
  decidedAt: request.decidedAt || null,
  decidedBy: request.decidedBy?.fullname || null,
  createdAt: request.createdAt,
});

/**
 * The days this intern may not request because attendance is already recorded.
 *
 * A `cancelled` row is deliberately NOT counted: cancelling unchecks the day, so
 * it is free to be claimed as remote — and `applyApproval` below flips that same
 * row rather than colliding with the unique { intern, date } index.
 */
const takenDayKeys = async (internId) => {
  const rows = await Attendance.find({ intern: internId, status: { $ne: Attendance.CANCELLED } })
    .select('date')
    .lean();
  return new Set(rows.map((row) => row.date));
};

// Everything the day rules need about this intern, gathered once so both the
// create path and the approve path judge a day on identical grounds.
const loadDayContext = async (profile) => {
  const nonWorking = await loadNonWorkingDays();
  return {
    todayKey: officeDateKey(),
    nonWorkingKeys: nonWorking.keys,
    startKey: profile.startDate ? officeDateKey(profile.startDate) : null,
    placedAtKey: profile.placedAt ? officeDateKey(profile.placedAt) : null,
    takenKeys: await takenDayKeys(profile._id),
  };
};

const liveRequestsFor = (internId) =>
  RemoteWorkRequest.find({ intern: internId, status: { $in: LIVE_STATUSES } })
    .select('dates status')
    .lean();

/**
 * The signed-in intern's own requests, newest first.
 *
 * No quota is reported because there is no quota on the intern — only the 3-day
 * ceiling on each request, which the client already knows.
 */
const listMyRequests = async (user) => {
  const profile = await loadMyProfile(user);
  const requests = await RemoteWorkRequest.find({ intern: profile._id })
    .populate({ path: 'decidedBy', select: 'fullname' })
    .sort({ createdAt: -1 })
    .lean();

  return { requests: requests.map(toRequestSummary), maxDaysPerRequest: MAX_DAYS_PER_REQUEST };
};

/** Ask to work remotely on 1–3 days, decided together. */
const createMyRequest = async (user, { dates, reason } = {}) => {
  const profile = await loadMyProfile(user);
  const context = await loadDayContext(profile);
  const existingRequests = await liveRequestsFor(profile._id);

  const days = normaliseDates(dates);
  const refusal = createRequestRefusal(days, { ...context, existingRequests });
  if (refusal) throw httpError(refusal, 422);

  await RemoteWorkRequest.create({
    intern: profile._id,
    dates: days,
    status: PENDING,
    reason: (reason || '').trim(),
  });

  return listMyRequests(user);
};

/** Withdraw one of your own requests. Only while it is still undecided. */
const cancelMyRequest = async (user, requestId) => {
  const profile = await loadMyProfile(user);
  const request = await findRequest(requestId);

  if (request.intern.toString() !== profile._id.toString()) {
    throw httpError('Remote work request not found.', 404);
  }
  if (request.status !== PENDING) {
    throw httpError('Only a request that is still waiting on a decision can be withdrawn.', 409);
  }

  request.status = CANCELLED;
  await request.save();
  return listMyRequests(user);
};

const findRequest = async (requestId) => {
  let request;
  try {
    request = await RemoteWorkRequest.findById(requestId);
  } catch (err) {
    if (err.name === 'CastError') throw httpError('Remote work request not found.', 404);
    throw err;
  }
  if (!request) throw httpError('Remote work request not found.', 404);
  return request;
};

const toInternSummary = (profile) => ({
  id: profile._id,
  fullname: profile.user?.fullname || '',
  email: profile.user?.email || '',
  hub: profile.user?.hub?.name || '',
});

/**
 * The admin queue. Defaults to `pending` — the only status that needs action —
 * with the whole history available on request. Pending is ordered by the day
 * being asked for, not by when it was submitted: the request for tomorrow is the
 * urgent one.
 */
const listRequests = async (_user, { status = PENDING } = {}) => {
  const filter = status === 'all' ? {} : { status };
  const requests = await RemoteWorkRequest.find(filter)
    .populate({
      path: 'intern',
      select: 'user',
      populate: {
        path: 'user',
        select: 'fullname email hub',
        populate: { path: 'hub', select: 'name' },
      },
    })
    .populate({ path: 'decidedBy', select: 'fullname' })
    // By the earliest day asked for: `dates` is stored sorted and Mongo ranks an
    // array on its smallest element, so the request about to go stale sorts first.
    .sort({ dates: 1, createdAt: 1 })
    .lean();

  const pendingCount = await RemoteWorkRequest.countDocuments({ status: PENDING });

  return {
    requests: requests
      .filter((request) => request.intern) // drop orphans, as the roster does
      .map((request) => ({
        ...toRequestSummary(request),
        intern: toInternSummary(request.intern),
      })),
    pendingCount,
  };
};

/**
 * Write the attendance rows an approval promises — one per day in the request.
 *
 * Re-uses a cancelled row for a day rather than inserting beside it: the unique
 * { intern, date } index allows only one, and `checkIn` re-uses that row the same
 * way.
 */
const applyApproval = async (request, now) => {
  for (const date of request.dates) {
    const existing = await Attendance.findOne({ intern: request.intern, date });
    if (existing) {
      existing.status = REMOTE;
      existing.checkedInAt = now;
      existing.remoteRequest = request._id;
      await existing.save();
      continue;
    }
    await Attendance.create({
      intern: request.intern,
      date,
      status: REMOTE,
      // No check-in happened. Stamped with the approval so the row still carries
      // *when* it came to exist; the UI shows a check-in time for `present` only.
      checkedInAt: now,
      remoteRequest: request._id,
    });
  }
};

/**
 * Approve or reject a pending request (admin). A request is decided as a unit —
 * every day in it, or none.
 *
 * Approval re-runs the day rules on **every** day before writing any of them. The
 * world moves between asking and answering: the intern may have been placed on a
 * project, a day may have become a cohort holiday, or they may have checked in
 * for one in person. Trusting the verdict recorded at request time would write
 * attendance the rules would now refuse.
 */
const decideRequest = async (user, requestId, { decision, note } = {}) => {
  if (decision !== APPROVED && decision !== REJECTED) {
    throw httpError('A decision must be either approved or rejected.', 400);
  }

  const request = await findRequest(requestId);
  if (request.status !== PENDING) {
    throw httpError(`This request has already been ${request.status}.`, 409);
  }

  if (decision === APPROVED) {
    const profile = await InternProfile.findById(request.intern).lean();
    if (!profile) throw httpError('Intern not found.', 404);

    const context = await loadDayContext(profile);
    for (const date of request.dates) {
      const refusal = requestDayRefusal(date, context);
      if (refusal) {
        throw httpError(
          `Cannot approve ${date}: ${refusal.replace(/^You /, 'the intern ').toLowerCase()}`,
          422
        );
      }
    }

    await applyApproval(request, new Date());
  }

  request.status = decision;
  request.decidedBy = user._id;
  request.decidedAt = new Date();
  request.decisionNote = (note || '').trim();
  await request.save();

  return listRequests(user);
};

/**
 * Undo an approval (admin), for a request granted in error. Removes every day it
 * had written, since the request was approved as a unit.
 *
 * Deletes only rows this request created — matched on `remoteRequest`, never on
 * { intern, date } — so an approval later superseded by something else cannot
 * destroy that other record on its way out.
 */
const revokeRequest = async (user, requestId, { note } = {}) => {
  const request = await findRequest(requestId);
  if (request.status !== APPROVED) {
    throw httpError('Only an approved request can be revoked.', 409);
  }

  await Attendance.deleteMany({ remoteRequest: request._id, status: REMOTE });

  request.status = REVOKED;
  request.decidedBy = user._id;
  request.decidedAt = new Date();
  request.decisionNote = (note || '').trim();
  await request.save();

  return listRequests(user);
};

module.exports = {
  listMyRequests,
  createMyRequest,
  cancelMyRequest,
  listRequests,
  decideRequest,
  revokeRequest,
};
