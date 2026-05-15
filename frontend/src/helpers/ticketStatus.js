const slugToColumnId = (slug) =>
  String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'column';

export const DEFAULT_STATUS_DRAFTS = [
  { label: 'Backlog', color: '#6b7280', isBacklog: true, tracksTime: false, isDone: false },
  { label: 'To do', color: '#64748b', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'In progress', color: '#3b82f6', isBacklog: false, tracksTime: true, isDone: false },
  { label: 'On staging', color: '#8b5cf6', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'Blocked', color: '#ef4444', isBacklog: false, tracksTime: false, isDone: false },
  { label: 'Done', color: '#22c55e', isBacklog: false, tracksTime: false, isDone: true },
];

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
  const normalized = borderTopColor.startsWith('#') ? borderTopColor : `#${borderTopColor.replace(/^#/, '')}`;
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

  const statusOptions = boardStatuses.map((s) => ({
    value: s.slug,
    label: s.label,
    columnId: slugToColumnId(s.slug),
    color: s.color,
    tracksTime: s.tracksTime,
    isDone: s.isDone,
  }));

  const statusToColumn = Object.fromEntries(
    statusOptions.map((s) => [s.value, s.columnId])
  );

  /** Pre-custom-status ticket values only — must not overwrite real slugs like "closed". */
  const legacyStatusToColumn = {
    open: statusOptions[0]?.columnId ?? 'todo',
    pending:
      statusOptions.find((s) => s.tracksTime)?.columnId ?? statusOptions[0]?.columnId ?? 'todo',
    closed: statusOptions.find((s) => s.isDone)?.columnId ?? 'done',
  };

  const resolveBoardColumnId = (status) => {
    const key = status?.toLowerCase();
    if (!key) return boardColumns[0]?.id;
    return statusToColumn[key] ?? legacyStatusToColumn[key] ?? boardColumns[0]?.id;
  };

  const columnToStatus = Object.fromEntries(
    statusOptions.map((s) => [s.columnId, s.value])
  );

  const boardColumns = statusOptions.map((s) => ({
    id: s.columnId,
    title: s.label,
    slug: s.value,
    color: s.color,
  }));

  const statusTabs = [
    { key: 'all', label: 'All' },
    ...statusOptions.map((s) => ({ key: s.value, label: s.label })),
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

  const backlogStatus = statuses.find((s) => s.isBacklog);
  const defaultMainStatus = boardStatuses[0]?.slug ?? 'to do';
  const defaultBacklogStatus = backlogStatus?.slug ?? 'backlog';

  const tracksTimeSlugs = new Set(statuses.filter((s) => s.tracksTime).map((s) => s.slug));
  const doneSlugs = new Set(statuses.filter((s) => s.isDone).map((s) => s.slug));

  return {
    statusOptions,
    statusTabs,
    statusToColumn,
    legacyStatusToColumn,
    resolveBoardColumnId,
    columnToStatus,
    boardColumns,
    statusBadgeConfig,
    backlogSlug: defaultBacklogStatus,
    defaultMainStatus,
    tracksTimeSlugs,
    doneSlugs,
    getStatusColor: (status) => {
      const match = statuses.find((s) => s.slug === status?.toLowerCase());
      if (match?.color) return match.color;
      if (doneSlugs.has(status?.toLowerCase())) return '#22c55e';
      if (tracksTimeSlugs.has(status?.toLowerCase())) return '#3b82f6';
      return '#9E54B0';
    },
    statusTracksTime: (status) => tracksTimeSlugs.has(status?.toLowerCase()),
    statusIsDone: (status) => doneSlugs.has(status?.toLowerCase()),
  };
};

export const getColumnStyle = (helpers, columnId) => {
  const col = helpers.boardColumns.find((c) => c.id === columnId);
  return getColumnAccentStyles(col?.color);
};
