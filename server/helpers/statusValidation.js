const TicketStatus = require('../models/TicketStatus');
const { slugifyLabel } = require('./statusSlugAliases');

const MAX_STATUS_LABEL_LENGTH = 50;

class StatusValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatusValidationError';
    this.statusCode = 400;
  }
}

const BEHAVIOR_FLAG_KEYS = ['isBacklog', 'tracksTime', 'isDone'];

const normalizeStatusBehaviorFlags = (flags = {}) => {
  const isBacklog = Boolean(flags.isBacklog);
  const tracksTime = Boolean(flags.tracksTime);
  const isDone = Boolean(flags.isDone);

  if (isBacklog) {
    return { isBacklog: true, tracksTime: false, isDone: false };
  }
  if (tracksTime) {
    return { isBacklog: false, tracksTime: true, isDone: false };
  }
  if (isDone) {
    return { isBacklog: false, tracksTime: false, isDone: true };
  }
  return { isBacklog: false, tracksTime: false, isDone: false };
};

const assertSingleBehaviorFlagPerStatus = (statuses) => {
  for (const status of statuses) {
    const count = BEHAVIOR_FLAG_KEYS.filter((key) => Boolean(status[key])).length;
    if (count > 1) {
      throw new StatusValidationError(
        'Each status can have only one behavior flag: Backlog, Tracks time, or Done.'
      );
    }
  }
};

const assertBehaviorFlagCounts = (statuses) => {
  assertSingleBehaviorFlagPerStatus(statuses);

  const backlogCount = statuses.filter((status) => status.isBacklog).length;
  const tracksTimeCount = statuses.filter((status) => status.tracksTime).length;
  const doneCount = statuses.filter((status) => status.isDone).length;
  const mainBoardCount = statuses.filter((status) => !status.isBacklog).length;

  if (mainBoardCount === 0) {
    throw new StatusValidationError(
      'At least one status must be on the main board (turn off Backlog for at least one column).'
    );
  }

  if (backlogCount !== 1) {
    throw new StatusValidationError(
      backlogCount === 0
        ? 'Workspace must have exactly one Backlog status.'
        : 'Only one status can be marked as Backlog.'
    );
  }

  if (tracksTimeCount !== 1) {
    throw new StatusValidationError(
      tracksTimeCount === 0
        ? 'Workspace must have exactly one status that tracks time.'
        : 'Only one status can track time.'
    );
  }

  if (doneCount !== 1) {
    throw new StatusValidationError(
      doneCount === 0
        ? 'Workspace must have exactly one Done status.'
        : 'Only one status can be marked as Done.'
    );
  }
};

const validateStatusesPayload = (statusesPayload) => {
  if (!Array.isArray(statusesPayload)) {
    throw new StatusValidationError('Ticket statuses must be provided as a list.');
  }

  if (statusesPayload.length === 0) {
    throw new StatusValidationError('Add at least one ticket status.');
  }

  const labelKeys = new Set();
  const slugKeys = new Set();
  const normalizedStatuses = [];

  statusesPayload.forEach((item, index) => {
    const position = index + 1;
    const label = String(item?.label || '').trim();

    if (!label) {
      throw new StatusValidationError(`Status ${position}: name is required.`);
    }

    if (label.length > MAX_STATUS_LABEL_LENGTH) {
      throw new StatusValidationError(
        `Status "${label}": name must be ${MAX_STATUS_LABEL_LENGTH} characters or fewer.`
      );
    }

    const labelKey = label.toLowerCase();
    if (labelKeys.has(labelKey)) {
      throw new StatusValidationError(`Duplicate status name "${label}".`);
    }
    labelKeys.add(labelKey);

    const slug = item?.slug ? slugifyLabel(item.slug) : slugifyLabel(label);
    if (!slug) {
      throw new StatusValidationError(`Status ${position}: could not derive a valid status key.`);
    }

    if (slugKeys.has(slug)) {
      throw new StatusValidationError(
        `Statuses "${label}" and another status resolve to the same key ("${slug}"). Use distinct names.`
      );
    }
    slugKeys.add(slug);

    normalizedStatuses.push({
      isBacklog: Boolean(item?.isBacklog),
      tracksTime: Boolean(item?.tracksTime),
      isDone: Boolean(item?.isDone),
    });
  });

  assertBehaviorFlagCounts(normalizedStatuses);
};

const buildEffectiveStatuses = (statuses, { omitStatusId = null, replaceStatus = null } = {}) => {
  const omitId = omitStatusId?.toString();
  const replaceId = replaceStatus?._id?.toString();

  const effective = statuses
    .filter((status) => !omitId || status._id.toString() !== omitId)
    .map((status) => {
      if (replaceId && status._id.toString() === replaceId) {
        return {
          isBacklog: Boolean(replaceStatus.isBacklog),
          tracksTime: Boolean(replaceStatus.tracksTime),
          isDone: Boolean(replaceStatus.isDone),
        };
      }

      return {
        isBacklog: Boolean(status.isBacklog),
        tracksTime: Boolean(status.tracksTime),
        isDone: Boolean(status.isDone),
      };
    });

  if (replaceStatus && !replaceId) {
    effective.push({
      isBacklog: Boolean(replaceStatus.isBacklog),
      tracksTime: Boolean(replaceStatus.tracksTime),
      isDone: Boolean(replaceStatus.isDone),
    });
  }

  return effective;
};

const assertWorkspaceBehaviorFlags = async (
  workspaceId,
  { omitStatusId = null, replaceStatus = null } = {}
) => {
  const statuses = await TicketStatus.find({ workspace: workspaceId }).lean();
  const effective = buildEffectiveStatuses(statuses, { omitStatusId, replaceStatus });
  assertBehaviorFlagCounts(effective);
};

const assertUniqueLabelInWorkspace = async (workspaceId, label, excludeStatusId = null) => {
  const normalized = String(label || '')
    .trim()
    .toLowerCase();
  if (!normalized) return;

  const query = { workspace: workspaceId };
  if (excludeStatusId) {
    query._id = { $ne: excludeStatusId };
  }

  const statuses = await TicketStatus.find(query).select('label').lean();
  const duplicate = statuses.find((status) => status.label?.trim().toLowerCase() === normalized);

  if (duplicate) {
    throw new StatusValidationError(
      `A status named "${label.trim()}" already exists in this workspace.`
    );
  }
};

const validateStatusLabel = (label) => {
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    throw new StatusValidationError('Status name is required.');
  }
  if (trimmed.length > MAX_STATUS_LABEL_LENGTH) {
    throw new StatusValidationError(
      `Status name must be ${MAX_STATUS_LABEL_LENGTH} characters or fewer.`
    );
  }
  return trimmed;
};

const mapStatusPersistenceError = (error) => {
  if (error?.name === 'StatusValidationError') {
    return error;
  }

  if (error?.code === 11000) {
    return new StatusValidationError('A status with this name already exists in this workspace.');
  }

  return error;
};

module.exports = {
  StatusValidationError,
  MAX_STATUS_LABEL_LENGTH,
  BEHAVIOR_FLAG_KEYS,
  normalizeStatusBehaviorFlags,
  validateStatusesPayload,
  validateStatusLabel,
  assertWorkspaceBehaviorFlags,
  assertUniqueLabelInWorkspace,
  mapStatusPersistenceError,
};
