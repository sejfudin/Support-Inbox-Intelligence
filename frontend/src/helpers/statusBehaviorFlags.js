export const BEHAVIOR_FLAG_KEYS = ['isBacklog', 'tracksTime', 'isDone'];

/** At most one behavior flag per status. */
export const normalizeStatusBehaviorFlags = (flags) => {
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

/** Apply flag change on one status (single-flag rule). */
export const applyStatusBehaviorFlagPatch = (item, patch) =>
  normalizeStatusBehaviorFlags({ ...item, ...patch });

/** Turn one flag on (clears the other two on this status). Turning off clears only that flag. */
export const toggleStatusBehaviorFlag = (item, flagKey, checked) => {
  if (checked) {
    return normalizeStatusBehaviorFlags({
      isBacklog: flagKey === 'isBacklog',
      tracksTime: flagKey === 'tracksTime',
      isDone: flagKey === 'isDone',
    });
  }
  return normalizeStatusBehaviorFlags({ ...item, [flagKey]: false });
};

export const statusGainedBehaviorFlag = (item, prev) =>
  BEHAVIOR_FLAG_KEYS.some((key) => Boolean(item[key]) && !prev[key]);

export const statusLostBehaviorFlag = (item, prev) =>
  BEHAVIOR_FLAG_KEYS.some((key) => !item[key] && prev[key]);

/**
 * When moving a flag between statuses, only PATCH the status that gains it (server clears siblings).
 * PATCH losers only when nothing else gained that flag in the same edit.
 */
export const getStatusesToPersist = (changedItems, prevItems) => {
  const someoneGainedFlagKey = (flagKey) =>
    changedItems.some((other) => {
      const otherPrev = prevItems.find((p) => String(p._id) === String(other._id));
      if (!otherPrev) return false;
      return Boolean(other[flagKey]) && !otherPrev[flagKey];
    });

  const shouldPersist = (item) => {
    const prev = prevItems.find((p) => String(p._id) === String(item._id));
    if (!prev) return true;

    const labelOrColorChanged = item.label !== prev.label || item.color !== prev.color;
    if (labelOrColorChanged) return true;

    if (statusGainedBehaviorFlag(item, prev)) return true;

    const lostKeys = BEHAVIOR_FLAG_KEYS.filter((key) => !item[key] && prev[key]);
    if (lostKeys.length === 0) return false;

    const lostBecauseTransfer = lostKeys.every((key) => someoneGainedFlagKey(key));
    return !lostBecauseTransfer;
  };

  const toPersist = changedItems.filter(shouldPersist);

  return toPersist.sort((a, b) => {
    const prevA = prevItems.find((p) => String(p._id) === String(a._id));
    const prevB = prevItems.find((p) => String(p._id) === String(b._id));
    const gainA = prevA && statusGainedBehaviorFlag(a, prevA);
    const gainB = prevB && statusGainedBehaviorFlag(b, prevB);
    if (gainA && !gainB) return -1;
    if (!gainA && gainB) return 1;
    return 0;
  });
};

/**
 * Apply flag change on one status and move each enabled flag from siblings in the list.
 */
export const applyWorkspaceBehaviorFlagPatch = (items, targetIndex, patch) => {
  const target = items[targetIndex];
  if (!target) return items;

  const merged = { ...target, ...patch };
  const normalizedTarget = normalizeStatusBehaviorFlags({
    isBacklog: merged.isBacklog,
    tracksTime: merged.tracksTime,
    isDone: merged.isDone,
  });
  const updatedTarget = { ...merged, ...normalizedTarget };

  return items.map((item, index) => {
    if (index === targetIndex) {
      return updatedTarget;
    }

    const next = { ...item };
    for (const key of BEHAVIOR_FLAG_KEYS) {
      if (normalizedTarget[key]) {
        next[key] = false;
      }
    }
    return next;
  });
};

export const countBehaviorFlags = (flags) =>
  BEHAVIOR_FLAG_KEYS.filter((key) => Boolean(flags[key])).length;
