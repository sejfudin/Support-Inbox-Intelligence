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

/** Board column top border + card accent from workspace status color. */
export const getColumnAccentStyles = (color) => {
  const borderTopColor = color?.trim() || '#94a3b8';
  const rgb = parseHexColor(borderTopColor);
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
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : s.tracksTime
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-100 text-slate-600 border-slate-200',
        color: s.color,
      },
    ])
  );

  const defaultMainStatusId = getDefaultMainStatusId(statuses);
  const defaultMainStatusSlug = getDefaultMainStatusSlug(statuses);
  const backlogSlug = getBacklogSlug(statuses);

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
    resolveSlugFromStatusId,
    resolveStatusLabel: (statusRef) => resolveStatusLabel(statusRef, statuses),
    getDetailStatusOptions: (currentStatusId) =>
      buildDetailStatusOptions(allStatusOptions, statusOptions, currentStatusId),
    boardColumns,
    statusBadgeConfig,
    backlogSlug,
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

export const getColumnStyle = (helpers, columnId) => {
  const col = helpers.boardColumns.find((c) => c.id === columnId);
  return getColumnAccentStyles(col?.color);
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
