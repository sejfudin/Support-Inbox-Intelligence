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

    if (!item?.isBacklog) {
      mainBoardCount += 1;
    }
  });

  if (mainBoardCount === 0) {
    throw new StatusValidationError(
      'At least one status must be on the main board (turn off Backlog for at least one column).'
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
  validateStatusesPayload,
  validateStatusLabel,
  mapStatusPersistenceError,
};
