const User = require('../models/User');
const MentorComment = require('../models/MentorComment');
const { ROLES } = require('../constants/roles');
const { assertInternAccess, canWriteMentorData } = require('../helpers/internAccess');
const internNotificationService = require('./internNotificationService');

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

const canReadComment = (comment, viewerId) => {
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
      .populate('author', 'fullname role')
      .sort({ createdAt: -1 });
    return comments.map(formatCommentForIntern);
  }

  const comments = await MentorComment.find({ internProfile: profile._id })
    .populate('author', 'fullname email role')
    .populate('visibleTo', 'fullname email role')
    .sort({ createdAt: -1 });

  return comments.filter((c) => canReadComment(c, user._id)).map((c) => formatComment(c, user._id));
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
    const viewers = await User.find({
      _id: { $in: visibleIds },
      role: { $in: VIEWER_ROLES },
      status: 'active',
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
    { path: 'author', select: 'fullname email role' },
    { path: 'visibleTo', select: 'fullname email role' },
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
