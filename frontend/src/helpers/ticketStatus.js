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

const COLUMN_STYLE_KEYS = ['todo', 'inprogress', 'blocked', 'staging', 'done'];

const pickColumnStyleKey = (slug, index) => {
  const normalized = slugToColumnId(slug);
  if (COLUMN_STYLE_KEYS.includes(normalized)) return normalized;
  const keys = ['todo', 'inprogress', 'staging', 'blocked', 'done'];
  return keys[index % keys.length];
};

export const STATUS_STYLES = {
  todo: {
    pill: 'bg-slate-50 text-slate-600',
    border: 'border-slate-300',
    card: 'border-slate-200 shadow-[0_14px_28px_-24px_rgba(100,116,139,0.5)]',
  },
  inprogress: {
    pill: 'bg-blue-50 text-blue-600',
    border: 'border-blue-300',
    card: 'border-blue-200 shadow-[0_14px_28px_-24px_rgba(59,130,246,0.45)]',
  },
  blocked: {
    pill: 'bg-red-50 text-red-600',
    border: 'border-red-300',
    card: 'border-red-200 shadow-[0_14px_28px_-24px_rgba(239,68,68,0.4)]',
  },
  staging: {
    pill: 'bg-purple-50 text-purple-600',
    border: 'border-purple-300',
    card: 'border-purple-200 shadow-[0_14px_28px_-24px_rgba(168,85,247,0.45)]',
  },
  done: {
    pill: 'bg-green-50 text-green-600',
    border: 'border-green-300',
    card: 'border-green-200 shadow-[0_14px_28px_-24px_rgba(34,197,94,0.45)]',
  },
};

export const buildTicketStatusHelpers = (statuses = []) => {
  const boardStatuses = statuses.filter((s) => !s.isBacklog);

  const statusOptions = boardStatuses.map((s, index) => ({
    value: s.slug,
    label: s.label,
    columnId: slugToColumnId(s.slug),
    color: s.color,
    tracksTime: s.tracksTime,
    isDone: s.isDone,
    styleKey: pickColumnStyleKey(s.slug, index),
  }));

  const statusToColumn = Object.fromEntries(
    statusOptions.map((s) => [s.value, s.columnId])
  );
  statusToColumn.open = statusOptions[0]?.columnId ?? 'todo';
  statusToColumn.pending = statusOptions.find((s) => s.tracksTime)?.columnId ?? statusOptions[0]?.columnId;
  statusToColumn.closed = statusOptions.find((s) => s.isDone)?.columnId ?? 'done';

  const columnToStatus = Object.fromEntries(
    statusOptions.map((s) => [s.columnId, s.value])
  );

  const boardColumns = statusOptions.map((s) => ({
    id: s.columnId,
    title: s.label,
    slug: s.value,
    styleKey: s.styleKey,
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
  const styleKey = col?.styleKey ?? 'todo';
  return STATUS_STYLES[styleKey] ?? STATUS_STYLES.todo;
};
