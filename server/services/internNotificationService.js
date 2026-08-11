const Notification = require('../models/Notification');
const { sendToUser } = require('../socket/socketServer');
const { invalidationScopes } = require('../socket/invalidationScopes');
const { requestGroqOutputText, extractJsonObject } = require('./groqAiClient');
const {
  buildProgrammeUpdatePrompt,
  buildPlacementCelebrationPrompt,
} = require('../prompts/internNotificationPrompts');

/**
 * Notifications for the intern-programme domain (recommendations, evaluations,
 * readiness, specialization, lifecycle status) — the intern-facing counterpart
 * to `notificationService.js`, which stays focused on tickets. Kept as a
 * separate module because the recipient shape and event set are unrelated:
 * these never carry a `ticket`/`workspace`, always an `internProfile`.
 *
 * Every exported function is safe to call **without `await`** (fire-and-
 * forget) from a mutation service — it never throws and never rejects, so an
 * admin/mentor's action is never slowed down or broken by notification
 * generation, whether the failure is a DB hiccup or the AI provider being
 * unconfigured/down/slow. See `tryWarm` and `safe` below.
 */

const toId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value._id) return toId(value._id);
  return String(value);
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

/**
 * Best-effort rewrite of the deterministic fallback into warmer, natural
 * phrasing. Bounded by `requestGroqOutputText`'s own `GROQ_TIMEOUT_MS`.
 * Any failure at all — unconfigured API key, timeout, bad JSON, an empty
 * title/body — silently returns the fallback. Callers of `dispatch` never see
 * an AI error; a notification is always created either way.
 */
const tryWarm = async (promptBuilder, promptArgs, fallback) => {
  try {
    const raw = await requestGroqOutputText({ prompt: promptBuilder(promptArgs) });
    const parsed = extractJsonObject(raw);
    const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
    const body = typeof parsed?.body === 'string' ? parsed.body.trim() : '';
    if (!title || !body) return fallback;
    return { title: title.slice(0, 200), body: body.slice(0, 500) };
  } catch {
    return fallback;
  }
};

const dispatch = async ({
  internUserId,
  internProfileId,
  type,
  link,
  fallback,
  promptBuilder,
  promptArgs,
}) => {
  const recipientId = toId(internUserId);
  if (!recipientId) return;

  const { title, body } = promptBuilder
    ? await tryWarm(promptBuilder, promptArgs, fallback)
    : fallback;

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title,
    body,
    internProfile: internProfileId || null,
    link: link || '',
  });

  sendToUser(recipientId, 'new_notification', {
    notification: notification.toObject(),
    recipientId,
    scopes: [invalidationScopes.user(recipientId)],
    unreadDelta: 1,
  });
};

// Wraps every exported function so callers can invoke it bare
// (`internNotificationService.notifyX(...)`, no `await`, no `.catch()`) —
// the try/catch has to live here, not at each of the ~15 call sites, because
// an unhandled rejection from a non-awaited async call is a process-level risk.
const safe = (fn) => (args) =>
  fn(args).catch((err) => {
    console.error('[internNotificationService]', err.message);
  });

const notifyRecommendationCreated = safe(
  async ({ internUserId, internProfileId, position, project }) => {
    await dispatch({
      internUserId,
      internProfileId,
      type: 'recommendation_created',
      link: '/dashboard',
      fallback: {
        title: "You've been put forward for a project",
        body: `You're being considered for ${position} on ${project}.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: 'The intern was put forward (recommended) for a project.',
        details: `Position: ${position}. Project: ${project}.`,
      },
    });
  }
);

const RECOMMENDATION_STAGE_LABELS = { interviewing: 'Interviewing', resulted: 'Resulted' };

const notifyRecommendationStatusChanged = safe(
  async ({ internUserId, internProfileId, project, newStatus }) => {
    const label = RECOMMENDATION_STAGE_LABELS[newStatus] || newStatus;
    await dispatch({
      internUserId,
      internProfileId,
      type: 'recommendation_status_changed',
      link: '/dashboard',
      fallback: {
        title: 'Your recommendation moved forward',
        body: `Your recommendation for ${project} is now at the ${label} stage.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: "The intern's recommendation moved to a new pipeline stage.",
        details: `Project: ${project}. New stage: ${label}.`,
      },
    });
  }
);

const notifyRecommendationNotPlaced = safe(async ({ internUserId, internProfileId, project }) => {
  await dispatch({
    internUserId,
    internProfileId,
    type: 'recommendation_not_placed',
    link: '/dashboard',
    fallback: {
      title: 'Update on your recommendation',
      body: `You weren't placed on ${project} this time. New opportunities come up regularly.`,
    },
    promptBuilder: buildProgrammeUpdatePrompt,
    promptArgs: {
      summary: "The intern's recommendation was resolved as not placed this time.",
      details: `Project: ${project}.`,
    },
  });
});

const notifyInternPlaced = safe(
  async ({ internUserId, internProfileId, position, project, startDate }) => {
    const startLabel = formatDate(startDate);
    await dispatch({
      internUserId,
      internProfileId,
      type: 'intern_placed',
      link: '/dashboard',
      fallback: {
        title: "You've been placed on a project!",
        body: `Congratulations — you're now placed as ${position || 'your role'} on ${
          project || 'a project'
        }${startLabel ? `, starting ${startLabel}` : ''}.`,
      },
      promptBuilder: buildPlacementCelebrationPrompt,
      promptArgs: { position, project, startDate: startLabel },
    });
  }
);

const notifyEvaluationCreated = safe(
  async ({ internUserId, internProfileId, periodStart, periodEnd }) => {
    const startLabel = formatDate(periodStart);
    const endLabel = formatDate(periodEnd);
    await dispatch({
      internUserId,
      internProfileId,
      type: 'evaluation_created',
      link: '/dashboard',
      fallback: {
        title: 'New evaluation available',
        body: `A new evaluation covering ${startLabel} – ${endLabel} was added to your profile.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: 'A new performance evaluation was added for the intern.',
        details: `Period: ${startLabel} to ${endLabel}.`,
      },
    });
  }
);

const notifyReadinessUpdated = safe(async ({ internUserId, internProfileId, label, level }) => {
  await dispatch({
    internUserId,
    internProfileId,
    type: 'readiness_updated',
    link: '/profile',
    fallback: {
      title: 'Your readiness was updated',
      body: `${label} readiness is now set to "${level}".`,
    },
    promptBuilder: buildProgrammeUpdatePrompt,
    promptArgs: {
      summary: "The intern's readiness assessment for a skill or role was updated.",
      details: `Skill/role: ${label}. New level: ${level}.`,
    },
  });
});

const notifySpecializationAssigned = safe(
  async ({ internUserId, internProfileId, positionLabel, mentorName }) => {
    await dispatch({
      internUserId,
      internProfileId,
      type: 'specialization_assigned',
      link: '/profile',
      fallback: {
        title: 'Specialization confirmed',
        body: `Your specialization is now ${positionLabel}, with ${mentorName} as your mentor.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: "The intern's specialization was confirmed.",
        details: `Position: ${positionLabel}. Mentor: ${mentorName}.`,
      },
    });
  }
);

const notifySpecializationReassigned = safe(
  async ({ internUserId, internProfileId, positionLabel }) => {
    await dispatch({
      internUserId,
      internProfileId,
      type: 'specialization_reassigned',
      link: '/profile',
      fallback: {
        title: 'Specialization updated',
        body: `Your specialization was corrected to ${positionLabel}.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: "The intern's specialization position was corrected.",
        details: `New position: ${positionLabel}.`,
      },
    });
  }
);

const notifySpecializationMentorChanged = safe(
  async ({ internUserId, internProfileId, mentorName }) => {
    await dispatch({
      internUserId,
      internProfileId,
      type: 'specialization_mentor_changed',
      link: '/profile',
      fallback: {
        title: 'Specialization mentor updated',
        body: `${mentorName} is now your specialization mentor.`,
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: "The intern's specialization mentor was changed.",
        details: `New mentor: ${mentorName}.`,
      },
    });
  }
);

const notifySpecializationCleared = safe(async ({ internUserId, internProfileId }) => {
  await dispatch({
    internUserId,
    internProfileId,
    type: 'specialization_cleared',
    link: '/profile',
    fallback: {
      title: 'Specialization cleared',
      body: 'Your specialization assignment has been cleared.',
    },
    promptBuilder: buildProgrammeUpdatePrompt,
    promptArgs: { summary: "The intern's specialization assignment was cleared." },
  });
});

const INTERN_STATUS_LABELS = {
  active: 'Active',
  ready: 'Ready for placement',
  completed: 'Completed',
  discontinued: 'Discontinued',
};

const notifyInternStatusChanged = safe(async ({ internUserId, internProfileId, newStatus }) => {
  const label = INTERN_STATUS_LABELS[newStatus] || newStatus;
  await dispatch({
    internUserId,
    internProfileId,
    type: 'intern_status_changed',
    link: '/profile',
    fallback: {
      title: 'Your programme status changed',
      body: `Your status is now "${label}".`,
    },
    promptBuilder: buildProgrammeUpdatePrompt,
    promptArgs: {
      summary: "The intern's programme lifecycle status changed.",
      details: `New status: ${label}.`,
    },
  });
});

const notifyExpectedEndDateChanged = safe(
  async ({ internUserId, internProfileId, expectedEndDate }) => {
    const label = formatDate(expectedEndDate);
    await dispatch({
      internUserId,
      internProfileId,
      type: 'intern_expected_end_date_changed',
      link: '/profile',
      fallback: {
        title: 'Your expected end date was updated',
        body: label
          ? `Your expected end date is now ${label}.`
          : 'Your expected end date was cleared.',
      },
      promptBuilder: buildProgrammeUpdatePrompt,
      promptArgs: {
        summary: "The intern's expected internship end date was updated.",
        details: label ? `New expected end date: ${label}.` : 'The expected end date was cleared.',
      },
    });
  }
);

const notifyDocumentationLinksUpdated = safe(async ({ internUserId, internProfileId }) => {
  await dispatch({
    internUserId,
    internProfileId,
    type: 'intern_documentation_updated',
    link: '/profile',
    fallback: {
      title: 'New resources added to your profile',
      body: 'Your documentation links were updated.',
    },
    promptBuilder: buildProgrammeUpdatePrompt,
    promptArgs: { summary: "The intern's documentation links were updated." },
  });
});

module.exports = {
  notifyRecommendationCreated,
  notifyRecommendationStatusChanged,
  notifyRecommendationNotPlaced,
  notifyInternPlaced,
  notifyEvaluationCreated,
  notifyReadinessUpdated,
  notifySpecializationAssigned,
  notifySpecializationReassigned,
  notifySpecializationMentorChanged,
  notifySpecializationCleared,
  notifyInternStatusChanged,
  notifyExpectedEndDateChanged,
  notifyDocumentationLinksUpdated,
};
