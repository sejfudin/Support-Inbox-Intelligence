const User = require('../models/User');
const MentorComment = require('../models/MentorComment');
const { ROLES } = require('../constants/roles');
const { assertInternAccess, canWriteMentorData } = require('../helpers/internAccess');
const internNotificationService = require('./internNotificationService');
const { userSelect } = require('../constants/userSelect');

const VIEWER_ROLES = [ROLES.ADMIN, ROLES.MENTOR, ROLES.LEADERSHIP];

const formatComment = (comment, viewerId) => {
  const plain = comment.toObject ? comment.toObject() : comment;
  return {
    ...plain,
    id: plain._id,
    isAuthor: plain.author?._id?.toString() === viewerId.toString(),
  };
};

// The intern-facing shape deliberately withholds `visibleTo` (the staff audience
// this note also went to — not the intern's concern) and `visibleToIntern` itself
// (every note in this list has it true; a per-note flag with only one value is
// noise, not information).
const formatCommentForIntern = (comment) => {
  const plain = comment.toObject ? comment.toObject() : comment;
  const { visibleTo, visibleToIntern, internProfile, ...rest } = plain;
  return { ...rest, id: plain._id };
};

// Admins always read every note — the UI's "Admins only" label for an empty
// `visibleTo` (see `audienceOf` in InternCommentsPanel.jsx) is a promise about who
// the *narrowest* audience still includes, not just the author. Without this
// bypass a mentor's note with nobody added to `visibleTo` was readable by no admin
// at all — silently the opposite of what "Admins only" says.
const canReadComment = (comment, viewerId, viewerRole) => {
  if (viewerRole === ROLES.ADMIN) return true;
  const viewer = viewerId.toString();
  if (comment.author?._id?.toString() === viewer || comment.author?.toString() === viewer) {
    return true;
  }
  return (comment.visibleTo || []).some(
    (id) => id?._id?.toString() === viewer || id?.toString() === viewer
  );
};

const listComments = async (user, internUserId) => {
  const profile = await assertInternAccess(user, internUserId);

  // An intern can only ever reach their own profile here — `assertInternAccess`
  // already rejected any other one via `canViewInternProfile`. What they see is a
  // completely different filter from the staff view below: never author/`visibleTo`
  // (that's a staff-sharing concept that doesn't apply to them), only the notes
  // whose author explicitly marked them `visibleToIntern` at write time.
  if (user.role === ROLES.INTERN) {
    const comments = await MentorComment.find({
      internProfile: profile._id,
      visibleToIntern: true,
    })
      // Not `userSelect()`: the intern-facing view of a note deliberately does not
      // carry the author's email, and the shared projection includes it. Name,
      // role and face only.
      .populate('author', 'fullname role avatarUrl')
      .sort({ createdAt: -1 });
    return comments.map(formatCommentForIntern);
  }

  const comments = await MentorComment.find({ internProfile: profile._id })
    .populate('author', userSelect('role'))
    .populate('visibleTo', userSelect('role'))
    .sort({ createdAt: -1 });

  return comments
    .filter((c) => canReadComment(c, user._id, user.role))
    .map((c) => formatComment(c, user._id));
};

const createComment = async (
  user,
  internUserId,
  { content, visibleTo = [], visibleToIntern = false }
) => {
  const profile = await assertInternAccess(user, internUserId, { write: true });

  if (!canWriteMentorData(user, profile)) {
    const err = new Error('Not authorized to add comments');
    err.statusCode = 403;
    throw err;
  }

  if (!content?.trim()) throw new Error('Comment content is required');

  const visibleIds = [...new Set(visibleTo.map(String))].filter((id) => id !== user._id.toString());

  if (visibleIds.length > 0) {
    // Same exclusion as listCommentViewers (the picker that offers these ids
    // in the first place) — a QA test account must never become a real
    // recipient, even via a crafted id an admin could see on Platform
    // Management's "All Users" screen (`includeTestAccounts: true` there).
    const viewers = await User.find({
      _id: { $in: visibleIds },
      role: { $in: VIEWER_ROLES },
      status: 'active',
      isTestAccount: { $ne: true },
    }).select('_id');

    if (viewers.length !== visibleIds.length) {
      throw new Error('One or more visibility recipients are invalid');
    }
  }

  const comment = await MentorComment.create({
    internProfile: profile._id,
    author: user._id,
    content: content.trim(),
    visibleTo: visibleIds,
    visibleToIntern: Boolean(visibleToIntern),
  });

  await comment.populate([
    { path: 'author', select: userSelect('role') },
    { path: 'visibleTo', select: userSelect('role') },
  ]);

  // Staff-facing only — never the intern. `visibleTo` recipients already have
  // read access to this exact note, so this is just telling them it arrived.
  if (comment.visibleTo.length > 0) {
    const internUser = await User.findById(internUserId).select('fullname');
    for (const recipient of comment.visibleTo) {
      internNotificationService.notifyMentorNoteMention({
        recipientUserId: recipient._id,
        recipientRole: recipient.role,
        internUserId,
        internProfileId: profile._id,
        internName: internUser?.fullname || 'an intern',
        authorName: user.fullname,
      });
    }
  }

  // The one case that IS intern-facing: the author explicitly chose to share this
  // exact note with the intern it's about, so tell them it arrived — same shape as
  // the staff notification above, just the other recipient axis.
  if (comment.visibleToIntern) {
    internNotificationService.notifyInternMentorNoteShared({
      internUserId,
      internProfileId: profile._id,
      authorName: user.fullname,
    });
  }

  return formatComment(comment, user._id);
};

module.exports = { listComments, createComment };
