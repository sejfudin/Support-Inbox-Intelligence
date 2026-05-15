const TicketStatus = require('../models/TicketStatus');

const MAX_STATUS_LABEL_LENGTH = 50;

const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

class StatusValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatusValidationError';
    this.statusCode = 400;
  }
}

const validateStatusesPayload = (statusesPayload) => {
  if (!Array.isArray(statusesPayload)) {
    throw new StatusValidationError('Ticket statuses must be provided as a list.');
  }

  if (statusesPayload.length === 0) {
    throw new StatusValidationError('Add at least one ticket status.');
  }

  const labelKeys = new Set();
  const slugKeys = new Set();
  let mainBoardCount = 0;
  let backlogCount = 0;
  let tracksTimeCount = 0;
  let doneCount = 0;

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

    if (item?.isBacklog) {
      backlogCount += 1;
    } else {
      mainBoardCount += 1;
    }

    if (item?.tracksTime) {
      tracksTimeCount += 1;
    }

    if (item?.isDone) {
      doneCount += 1;
    }
  });

  if (mainBoardCount === 0) {
    throw new StatusValidationError(
      'At least one status must be on the main board (turn off Backlog for at least one column).'
    );
  }

  if (backlogCount > 1) {
    throw new StatusValidationError('Only one status can be marked as Backlog.');
  }

  if (tracksTimeCount > 1) {
    throw new StatusValidationError('Only one status can track time.');
  }

  if (doneCount > 1) {
    throw new StatusValidationError('Only one status can be marked as Done.');
  }
};

const assertUniqueBehaviorFlags = async (workspaceId, flags, excludeStatusId = null) => {
  const buildQuery = (field, value) => {
    const query = { workspace: workspaceId, [field]: value };
    if (excludeStatusId) {
      query._id = { $ne: excludeStatusId };
    }
    return query;
  };

  if (flags.isBacklog) {
    const conflict = await TicketStatus.exists(buildQuery('isBacklog', true));
    if (conflict) {
      throw new StatusValidationError('Only one status can be marked as Backlog.');
    }
  }

  if (flags.tracksTime) {
    const conflict = await TicketStatus.exists(buildQuery('tracksTime', true));
    if (conflict) {
      throw new StatusValidationError('Only one status can track time.');
    }
  }

  if (flags.isDone) {
    const conflict = await TicketStatus.exists(buildQuery('isDone', true));
    if (conflict) {
      throw new StatusValidationError('Only one status can be marked as Done.');
    }
  }
};

const assertUniqueLabelInWorkspace = async (workspaceId, label, excludeStatusId = null) => {
  const normalized = String(label || '').trim().toLowerCase();
  if (!normalized) return;

  const query = { workspace: workspaceId };
  if (excludeStatusId) {
    query._id = { $ne: excludeStatusId };
  }

  const statuses = await TicketStatus.find(query).select('label').lean();
  const duplicate = statuses.find((status) => status.label?.trim().toLowerCase() === normalized);

  if (duplicate) {
    throw new StatusValidationError(`A status named "${label.trim()}" already exists in this workspace.`);
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
  validateStatusesPayload,
  validateStatusLabel,
  assertUniqueBehaviorFlags,
  assertUniqueLabelInWorkspace,
  mapStatusPersistenceError,
};
