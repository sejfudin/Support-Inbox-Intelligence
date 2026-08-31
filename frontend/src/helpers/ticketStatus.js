import { extractStatusSlug, resolveStatusLabel } from '@/helpers/normalizeTicket';

export const DEFAULT_STATUS_DRAFTS = [
  { label: 'Backlog', color: '#6b7280', isBacklog: true, tracksTime: false, isDone: false },
  { label: 'To do', color: '#64748b', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'In progress', color: '#3b82f6', isBacklog: false, tracksTime: true, isDone: false },
  { label: 'On staging', color: '#8b5cf6', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'Blocked', color: '#ef4444', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'Done', color: '#22c55e', isBacklog: false, tracksTime: false, isDone: true },
];

export const getDefaultMainStatusSlug = (statuses = []) => {
  const board = statuses.filter((s) => !s.isBacklog);
  return board[0]?.slug ?? '';
};

export const getBacklogSlug = (statuses = []) => {
  return statuses.find((s) => s.isBacklog)?.slug ?? '';
};

export const getBacklogStatusId = (statuses = []) => {
  const backlog = statuses.find((s) => s.isBacklog);
  return backlog?._id != null ? String(backlog._id) : '';
};

export const getDefaultMainStatusId = (statuses = []) => {
  const board = statuses.filter((s) => !s.isBacklog);
  return board[0]?._id != null ? String(board[0]._id) : '';
};

/** Main-board statuses for changes; includes current backlog row only when ticket is already backlog. */
export const buildDetailStatusOptions = (allStatusOptions, boardStatusOptions, currentStatusId) => {
  const current = allStatusOptions.find((o) => o.value === String(currentStatusId));
  if (current?.isBacklog) {
    return [current, ...boardStatusOptions];
  }
  return boardStatusOptions;
};

const parseHexColor = (value) => {
  if (!value || typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
};

/**
 * A stored status colour, expressed as the nearest semantic tone.
 *
 * Board column colours are per-workspace data, not design tokens — they are hex
 * values someone picked in workspace settings and they live in Mongo. That makes
 * them the one part of the palette a colour vision mode cannot reach by
 * redefining a variable, and on the board they are load-bearing: a column is
 * identified by its stripe, with no other mark. So when a mode is on, the hue is
 * bucketed to the closest `--tone-*` and the column borrows that instead. Off,
 * the workspace's own colour is returned untouched.
 */
const toneVarForRgb = ({ r, g, b }) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // Greys have no hue to bucket, and a status deliberately set to grey should
  // stay grey in every mode.
  if (delta < 24) return '--tone-neutral';

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 20 || hue >= 330) return '--tone-danger';
  if (hue < 45) return '--tone-orange';
  if (hue < 70) return '--tone-warning';
  if (hue < 170) return '--tone-success';
  if (hue < 200) return '--tone-cyan';
  if (hue < 255) return '--tone-info';
  return '--tone-violet';
};

/**
 * The same remap for a plain dot — the status tabs above the ticket list, which
 * are the list view's version of the board's column stripe.
 */
export const statusDotColor = (color, toneMapped = false) => {
  if (!toneMapped) return color;
  const rgb = parseHexColor(color?.trim() || '');
  const tone = rgb ? toneVarForRgb(rgb) : '--tone-neutral';
  return tone === '--tone-neutral' ? 'hsl(var(--muted-foreground))' : `hsl(var(${tone}))`;
};

/**
 * Board column top border + card accent from workspace status color.
 *
 * @param {string} color stored hex
 * @param {boolean} toneMapped true while a colour vision mode is active
 */
export const getColumnAccentStyles = (color, toneMapped = false) => {
  const borderTopColor = color?.trim() || '#94a3b8';
  const rgb = parseHexColor(borderTopColor);

  if (toneMapped) {
    // `--tone-neutral` is not a real token — grey columns fall back to the muted
    // foreground, which is already mode-aware.
    const tone = rgb ? toneVarForRgb(rgb) : '--tone-neutral';
    const base = tone === '--tone-neutral' ? 'hsl(var(--muted-foreground))' : `hsl(var(${tone}))`;
    const tint =
      tone === '--tone-neutral'
        ? 'hsl(var(--muted-foreground) / 0.35)'
        : `hsl(var(${tone}) / 0.35)`;
    return {
      borderTopColor: base,
      cardStyle: { borderColor: tint },
    };
  }
  if (!rgb) {
    return {
      borderTopColor,
      cardStyle: { borderColor: `${borderTopColor}55` },
    };
  }
  const { r, g, b } = rgb;
  const normalized = borderTopColor.startsWith('#')
    ? borderTopColor
    : `#${borderTopColor.replace(/^#/, '')}`;
  return {
    borderTopColor: normalized,
    cardStyle: {
      borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      boxShadow: `0 14px 28px -24px rgba(${r}, ${g}, ${b}, 0.45)`,
    },
  };
};

export const buildTicketStatusHelpers = (statuses = []) => {
  const boardStatuses = statuses.filter((s) => !s.isBacklog);
  const hasStatuses = statuses.length > 0;

  const mapStatusOption = (s) => ({
    value: String(s._id),
    slug: s.slug,
    label: s.label,
    columnId: s._id != null ? String(s._id) : '',
    color: s.color,
    tracksTime: s.tracksTime,
    isDone: s.isDone,
    isBacklog: s.isBacklog,
  });

  const statusOptions = boardStatuses.map(mapStatusOption);
  const allStatusOptions = statuses.map(mapStatusOption);

  const boardColumns = statusOptions
    .filter((s) => s.columnId)
    .map((s) => ({
      id: s.columnId,
      title: s.label,
      slug: s.slug,
      color: s.color,
    }));

  const firstColumnId = boardColumns[0]?.id;
  const tracksColumnId = statusOptions.find((s) => s.tracksTime)?.columnId;
  const doneColumnId = statusOptions.find((s) => s.isDone)?.columnId;

  const statusToColumn = Object.fromEntries(
    statusOptions.filter((s) => s.columnId).map((s) => [s.value, s.columnId])
  );

  /** Pre-custom-status ticket values only — post-migration DB uses ObjectId refs. */
  const legacyStatusToColumn = {
    open: firstColumnId,
    pending: tracksColumnId ?? firstColumnId,
    closed: doneColumnId,
  };

  const resolveBoardColumnId = (status) => {
    const statusId =
      typeof status === 'object' && status?._id != null
        ? String(status._id)
        : statusOptions.some((o) => o.value === String(status))
          ? String(status)
          : '';
    if (statusId && statusToColumn[statusId]) {
      return statusToColumn[statusId];
    }

    const key = extractStatusSlug(status).toLowerCase();
    if (!key) return firstColumnId;
    const bySlug = statusOptions.find((o) => o.slug === key);
    if (bySlug?.columnId) return bySlug.columnId;
    return legacyStatusToColumn[key] ?? firstColumnId;
  };

  const columnToStatusId = Object.fromEntries(
    statusOptions.filter((s) => s.columnId).map((s) => [s.columnId, s.value])
  );

  const resolveStatusFromColumnId = (columnId) => columnToStatusId[columnId] ?? null;

  /**
   * The destination column's status as a *populated* status object, shaped like the
   * one the list endpoints send (`STATUS_POPULATE_SELECT` in
   * `server/services/ticketService.js`).
   *
   * This exists for the optimistic board move, which has to write a ticket's new
   * status into the column caches before the server answers. Writing the bare id
   * string there silently sends the card to the wrong column:
   * `extractStatusSlug` returns `''` for an ObjectId string, and
   * `resolveBoardColumnId` then falls through to `firstColumnId`. So the shape has
   * to match, not just the id.
   *
   * `sortOrder` is part of the server's projection but is deliberately absent
   * here — it is not in `mapStatusOption` and nothing on the client reads it off a
   * ticket's status. The refetch that follows the move restores it.
   */
  const resolveStatusDocFromColumnId = (columnId) => {
    const option = allStatusOptions.find((o) => o.columnId === String(columnId));
    if (!option) return null;

    return {
      _id: option.value,
      slug: option.slug,
      label: option.label,
      color: option.color,
      isBacklog: option.isBacklog,
      tracksTime: option.tracksTime,
      isDone: option.isDone,
    };
  };

  const resolveSlugFromStatusId = (statusId) => {
    const match = allStatusOptions.find((o) => o.value === String(statusId));
    return match?.slug ?? '';
  };

  const statusTabs = [
    { key: 'all', label: 'All' },
    ...statusOptions.map((s) => ({ key: s.slug, label: s.label })),
  ];

  const statusBadgeConfig = Object.fromEntries(
    statuses.map((s) => [
      s.slug,
      {
        label: s.label,
        variant: s.isDone ? 'outline' : s.tracksTime ? 'outline' : 'secondary',
        className: s.isDone
          ? 'bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))] border-[hsl(var(--tone-success)/0.3)] dark:bg-[hsl(var(--tone-success)/0.2)] dark:text-[hsl(var(--tone-success-fg))] dark:border-[hsl(var(--tone-success)/0.35)]'
          : s.tracksTime
            ? 'bg-[hsl(var(--tone-info)/0.15)] text-[hsl(var(--tone-info-fg))] border-[hsl(var(--tone-info)/0.3)] dark:bg-[hsl(var(--tone-info)/0.2)] dark:text-[hsl(var(--tone-info-fg))] dark:border-[hsl(var(--tone-info)/0.35)]'
            : 'bg-muted text-muted-foreground border-border',
        color: s.color,
      },
    ])
  );

  const defaultMainStatusId = getDefaultMainStatusId(statuses);
  const defaultMainStatusSlug = getDefaultMainStatusSlug(statuses);
  const backlogSlug = getBacklogSlug(statuses);
  const backlogStatusId = getBacklogStatusId(statuses);

  const tracksTimeSlugs = new Set(statuses.filter((s) => s.tracksTime).map((s) => s.slug));
  const doneSlugs = new Set(statuses.filter((s) => s.isDone).map((s) => s.slug));

  return {
    hasStatuses,
    statusOptions,
    allStatusOptions,
    statusTabs,
    statusToColumn,
    legacyStatusToColumn,
    resolveBoardColumnId,
    columnToStatusId,
    resolveStatusFromColumnId,
    resolveStatusDocFromColumnId,
    resolveSlugFromStatusId,
    resolveStatusLabel: (statusRef) => resolveStatusLabel(statusRef, statuses),
    getDetailStatusOptions: (currentStatusId) =>
      buildDetailStatusOptions(allStatusOptions, statusOptions, currentStatusId),
    boardColumns,
    statusBadgeConfig,
    backlogSlug,
    backlogStatusId,
    defaultMainStatus: defaultMainStatusSlug,
    defaultMainStatusId,
    defaultMainStatusSlug,
    tracksTimeSlugs,
    doneSlugs,
    getStatusColor: (status) => {
      const key = extractStatusSlug(status).toLowerCase();
      const match = statuses.find((s) => s.slug === key);
      if (match?.color) return match.color;
      if (doneSlugs.has(key)) return '#22c55e';
      if (tracksTimeSlugs.has(key)) return '#3b82f6';
      return '#9E54B0';
    },
    statusTracksTime: (status) => tracksTimeSlugs.has(extractStatusSlug(status).toLowerCase()),
    statusIsDone: (status) => doneSlugs.has(extractStatusSlug(status).toLowerCase()),
  };
};

export const getColumnStyle = (helpers, columnId, toneMapped = false) => {
  const col = helpers.boardColumns.find((c) => c.id === columnId);
  return getColumnAccentStyles(col?.color, toneMapped);
};

/** Default GitHub automation targets from workspace status config. */
export const getIntegrationStatusTargets = (statuses = []) => {
  if (!statuses.length) {
    return {
      onMergeTargetStatus: '',
      onPROpenTargetStatus: '',
      onMergeTargetStatusId: '',
      onPROpenTargetStatusId: '',
    };
  }

  const done = statuses.find((s) => s.isDone);
  const tracks = statuses.find((s) => s.tracksTime);
  const mainBoard = statuses.filter((s) => !s.isBacklog && !s.isDone);
  const prOpenStatus =
    mainBoard.find((s) => !s.tracksTime) ||
    tracks ||
    mainBoard[0] ||
    statuses.find((s) => !s.isBacklog) ||
    statuses[0];

  const mergeStatus = done || statuses.find((s) => !s.isBacklog) || statuses[0];

  return {
    onMergeTargetStatus: mergeStatus.slug,
    onPROpenTargetStatus: prOpenStatus.slug,
    onMergeTargetStatusId: mergeStatus._id != null ? String(mergeStatus._id) : '',
    onPROpenTargetStatusId: prOpenStatus._id != null ? String(prOpenStatus._id) : '',
  };
};
