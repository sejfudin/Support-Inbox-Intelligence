const MAX_STATUS_LABEL_LENGTH = 50;

const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const assertBehaviorFlagCounts = (statuses) => {
  const backlogCount = statuses.filter((status) => status.isBacklog).length;
  const tracksTimeCount = statuses.filter((status) => status.tracksTime).length;
  const doneCount = statuses.filter((status) => status.isDone).length;
  const mainBoardCount = statuses.filter((status) => !status.isBacklog).length;

  if (mainBoardCount === 0) {
    return {
      valid: false,
      message:
        'At least one status must be on the main board (turn off Backlog for at least one column).',
    };
  }

  if (backlogCount !== 1) {
    return {
      valid: false,
      message:
        backlogCount === 0
          ? 'Workspace must have exactly one Backlog status.'
          : 'Only one status can be marked as Backlog.',
    };
  }

  if (tracksTimeCount !== 1) {
    return {
      valid: false,
      message:
        tracksTimeCount === 0
          ? 'Workspace must have exactly one status that tracks time.'
          : 'Only one status can track time.',
    };
  }

  if (doneCount !== 1) {
    return {
      valid: false,
      message:
        doneCount === 0
          ? 'Workspace must have exactly one Done status.'
          : 'Only one status can be marked as Done.',
    };
  }

  return { valid: true, message: '' };
};

export const validateStatusDrafts = (drafts) => {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return { valid: false, message: 'Add at least one ticket status.' };
  }

  const labelKeys = new Set();
  const slugKeys = new Set();
  const normalizedStatuses = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const item = drafts[index];
    const position = index + 1;
    const label = String(item?.label || '').trim();

    if (!label) {
      return { valid: false, message: `Status ${position}: name is required.` };
    }

    if (label.length > MAX_STATUS_LABEL_LENGTH) {
      return {
        valid: false,
        message: `Status "${label}": name must be ${MAX_STATUS_LABEL_LENGTH} characters or fewer.`,
      };
    }

    const labelKey = label.toLowerCase();
    if (labelKeys.has(labelKey)) {
      return { valid: false, message: `Duplicate status name "${label}".` };
    }
    labelKeys.add(labelKey);

    const slug = item?.slug ? slugifyLabel(item.slug) : slugifyLabel(label);
    if (!slug) {
      return { valid: false, message: `Status ${position}: could not derive a valid status key.` };
    }

    if (slugKeys.has(slug)) {
      return {
        valid: false,
        message: `Statuses "${label}" and another status resolve to the same key ("${slug}"). Use distinct names.`,
      };
    }
    slugKeys.add(slug);

    normalizedStatuses.push({
      isBacklog: Boolean(item?.isBacklog),
      tracksTime: Boolean(item?.tracksTime),
      isDone: Boolean(item?.isDone),
    });
  }

  return assertBehaviorFlagCounts(normalizedStatuses);
};
