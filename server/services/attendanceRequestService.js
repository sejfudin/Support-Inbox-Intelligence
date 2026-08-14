const AttendanceRequest = require('../models/AttendanceRequest');
const Attendance = require('../models/Attendance');
const InternProfile = require('../models/InternProfile');
const { officeDateKey } = require('../helpers/attendanceTime');
const { loadNonWorkingDays } = require('../helpers/attendanceStats');
const {
  createRequestRefusal,
  requestDayRefusal,
  normaliseDates,
  budgetStateFor,
  usedDaysByYear,
  earliestRequestableKey,
  yearOf,
} = require('../helpers/attendanceRequestRules');
const {
  REQUEST_TYPES,
  REMOTE,
  TYPE_RULES,
  isRequestType,
} = require('../constants/attendanceRequestTypes');
const { httpError } = require('../helpers/httpError');
const { loadMyProfile } = require('./attendanceService');
const { getEffectiveLimits } = require('./attendanceSettingsService');

const { PENDING, APPROVED, REJECTED, CANCELLED, REVOKED, LIVE_STATUSES } = AttendanceRequest;

/**
 * Attendance requests: an intern asks for days — remote, vacation, a religious
 * holiday, a sick day — an admin decides them, and an approval writes the
 * `Attendance` rows itself.
 *
 * The rules live in `helpers/attendanceRequestRules.js` as pure functions so they
 * are unit-tested; this module is the Mongo half — load the context those rules
 * need, apply the verdict, keep the attendance rows in step.
 *
 * Nothing here branches on the type. Ceilings, budgets and backdating all come out
 * of `constants/attendanceRequestTypes.js` via the rules, and the attendance status
 * an approval writes is the type's own name.
 *
 * The ceiling and the budget are admin-set, so this module is where they are
 * loaded — `getEffectiveLimits()` once per request path — and handed to the pure
 * rules. Backdating and `attended` are not configurable and still come straight
 * off the table.
 */

const toRequestSummary = (request) => ({
  id: request._id,
  type: request.type || REMOTE,
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
 * A `cancelled` row is deliberately NOT counted: cancelling unchecks the day, so it
 * is free to be claimed — and `applyApproval` below flips that same row rather than
 * colliding with the unique { intern, date } index.
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

// Budgets count spent days across the whole history, not just live claims — a
// vacation taken in March is still spent in April. `usedDaysByYear` filters on
// status itself, so everything is loaded and it decides what counts.
const allRequestsFor = (internId) =>
  AttendanceRequest.find({ intern: internId }).select('dates status type').lean();

const liveRequestsFor = (internId) =>
  AttendanceRequest.find({ intern: internId, status: { $in: LIVE_STATUSES } })
    .select('dates status type')
    .lean();

/**
 * What the client needs to render the request form without hardcoding any of it:
 * every type, its ceiling, its remaining allowance this year, and the earliest day
 * it may be requested for.
 *
 * Sent with every list response so the panel updates the moment a request is filed
 * — an intern who has just spent their last vacation day sees the option lock
 * without a refresh.
 */
const buildTypeInfo = (requests, todayKey, nonWorkingKeys, limits) => {
  const year = yearOf(todayKey);
  return REQUEST_TYPES.map((type) => {
    const { label, backdateWorkingDays } = TYPE_RULES[type];
    return {
      type,
      label,
      // The admin's number, not the table's. This is the field the intern's date
      // picker bounds itself by, so a ceiling changed on the admin's profile
      // reaches the form on their next load with nothing else to do.
      maxDaysPerRequest: limits[type].maxDaysPerRequest,
      backdateWorkingDays,
      earliestDate: earliestRequestableKey(type, todayKey, nonWorkingKeys),
      // Sick may not be booked ahead: you cannot know you will be ill on Thursday.
      latestDate: backdateWorkingDays ? todayKey : null,
      budget: budgetStateFor(type, year, requests, limits),
      // Days spent this year, sent for **every** type including the unbudgeted ones.
      // The balance card shows "3 used" for those rather than a fraction: there is
      // no denominator, and inventing one would be a limit the rules do not enforce.
      used: usedDaysByYear(requests, type).get(year) || 0,
    };
  });
};

/**
 * The signed-in intern's own requests, newest first, with the per-type limits and
 * what is left of each budget.
 */
const listMyRequests = async (user) => {
  const profile = await loadMyProfile(user);
  const [requests, nonWorking, limits] = await Promise.all([
    AttendanceRequest.find({ intern: profile._id })
      .populate({ path: 'decidedBy', select: 'fullname' })
      .sort({ createdAt: -1 })
      .lean(),
    loadNonWorkingDays(),
    getEffectiveLimits(),
  ]);

  return {
    requests: requests.map(toRequestSummary),
    types: buildTypeInfo(requests, officeDateKey(), nonWorking.keys, limits),
  };
};

/** Ask for days of one type, decided together. */
const createMyRequest = async (user, { type = REMOTE, dates, reason } = {}) => {
  if (!isRequestType(type)) throw httpError('Pick what kind of day you are requesting.', 400);

  const profile = await loadMyProfile(user);
  const context = await loadDayContext(profile);
  // Every request, not just the live ones: the budget check has to see days already
  // spent this year, and `usedDaysByYear` decides for itself which statuses count.
  const [existingRequests, limits] = await Promise.all([
    allRequestsFor(profile._id),
    getEffectiveLimits(),
  ]);

  const days = normaliseDates(dates);
  const refusal = createRequestRefusal(days, { ...context, type, existingRequests, limits });
  if (refusal) throw httpError(refusal, 422);

  await AttendanceRequest.create({
    intern: profile._id,
    type,
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
    throw httpError('Request not found.', 404);
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
    request = await AttendanceRequest.findById(requestId);
  } catch (err) {
    if (err.name === 'CastError') throw httpError('Request not found.', 404);
    throw err;
  }
  if (!request) throw httpError('Request not found.', 404);
  return request;
};

const toInternSummary = (profile) => ({
  id: profile._id,
  fullname: profile.user?.fullname || '',
  email: profile.user?.email || '',
  hub: profile.user?.hub?.name || '',
});

/**
 * The admin queue. Defaults to `pending` — the only status that needs action — with
 * the whole history available on request, and an optional `type` filter. Pending is
 * ordered by the day being asked for, not by when it was submitted: the request for
 * tomorrow is the urgent one.
 */
const listRequests = async (_user, { status = PENDING, type } = {}) => {
  const filter = status === 'all' ? {} : { status };
  if (isRequestType(type)) filter.type = type;

  const requests = await AttendanceRequest.find(filter)
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

  // Counted unfiltered on purpose — the nav dot and the tab badge mean "anything
  // waiting", and would otherwise go dark whenever a type filter was applied.
  const pendingCount = await AttendanceRequest.countDocuments({ status: PENDING });
  const pendingByType = Object.fromEntries(
    await Promise.all(
      REQUEST_TYPES.map(async (t) => [
        t,
        await AttendanceRequest.countDocuments({ status: PENDING, type: t }),
      ])
    )
  );

  return {
    requests: requests
      .filter((request) => request.intern) // drop orphans, as the roster does
      .map((request) => ({
        ...toRequestSummary(request),
        intern: toInternSummary(request.intern),
      })),
    pendingCount,
    pendingByType,
  };
};

/**
 * Write the attendance rows an approval promises — one per day in the request.
 *
 * The status written is the request's own type: `remote` counts as an attended day,
 * while `vacation`, `religious` and `sick` take the day out of the denominator (see
 * `models/Attendance.js`). That mapping is the type name itself, which is why this
 * function has no table in it.
 *
 * Re-uses a cancelled row for a day rather than inserting beside it: the unique
 * { intern, date } index allows only one, and `checkIn` re-uses that row the same
 * way.
 */
const applyApproval = async (request, now) => {
  for (const date of request.dates) {
    const existing = await Attendance.findOne({ intern: request.intern, date });
    if (existing) {
      existing.status = request.type;
      existing.checkedInAt = now;
      existing.request = request._id;
      await existing.save();
      continue;
    }
    await Attendance.create({
      intern: request.intern,
      date,
      status: request.type,
      // No check-in happened. Stamped with the approval so the row still carries
      // *when* it came to exist; the UI shows a check-in time for `present` only.
      checkedInAt: now,
      request: request._id,
    });
  }
};

/**
 * Approve or reject a pending request (admin). A request is decided as a unit —
 * every day in it, or none.
 *
 * Approval re-runs the day rules on **every** day before writing any of them. The
 * world moves between asking and answering: the intern may have been placed on a
 * project, a day may have become a cohort holiday, or they may have checked in for
 * one in person. Trusting the verdict recorded at request time would write
 * attendance the rules would now refuse.
 *
 * The backdating window is deliberately NOT re-applied here. A sick day filed
 * legitimately on Wednesday for Monday would fall out of its own two-day window by
 * Thursday, and an admin who takes a day to answer must not thereby destroy the
 * request. The window bounds what an intern may *ask* for; the admin's judgement
 * bounds what is granted.
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
      // `todayKey: date` neutralises the past/future checks for exactly the reason
      // in the doc-comment above, while leaving every other rule — weekend,
      // holiday, before-start, placed, already-recorded — fully in force.
      const refusal = requestDayRefusal(date, { ...context, type: request.type, todayKey: date });
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
 * Deletes only rows this request created — matched on `request`, never on
 * { intern, date } — so an approval later superseded by something else cannot
 * destroy that other record on its way out.
 */
const revokeRequest = async (user, requestId, { note } = {}) => {
  const request = await findRequest(requestId);
  if (request.status !== APPROVED) {
    throw httpError('Only an approved request can be revoked.', 409);
  }

  await Attendance.deleteMany({ request: request._id });

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
