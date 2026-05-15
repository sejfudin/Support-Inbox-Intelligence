const MAX_STATUS_LABEL_LENGTH = 50;

const slugifyLabel = (label) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const validateStatusDrafts = (drafts) => {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return { valid: false, message: 'Add at least one ticket status.' };
  }

  const labelKeys = new Set();
  const slugKeys = new Set();
  let mainBoardCount = 0;
  let backlogCount = 0;
  let tracksTimeCount = 0;
  let doneCount = 0;

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
  }

  if (mainBoardCount === 0) {
    return {
      valid: false,
      message:
        'At least one status must be on the main board (turn off Backlog for at least one column).',
    };
  }

  if (backlogCount > 1) {
    return { valid: false, message: 'Only one status can be marked as Backlog.' };
  }

  if (tracksTimeCount > 1) {
    return { valid: false, message: 'Only one status can track time.' };
  }

  if (doneCount > 1) {
    return { valid: false, message: 'Only one status can be marked as Done.' };
  }

  return { valid: true, message: '' };
};
