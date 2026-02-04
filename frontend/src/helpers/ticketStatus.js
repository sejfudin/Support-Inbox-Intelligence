// frontend/src/helpers/ticketStatus.js

export const STATUS_OPTIONS = [
  { value: "to do", label: "To do", columnId: "todo" },
  { value: "in progress", label: "In progress", columnId: "inprogress" },
  { value: "on staging", label: "On staging", columnId: "staging" },
  { value: "blocked", label: "Blocked", columnId: "blocked" },
  { value: "done", label: "Done", columnId: "done" },
];

export const STATUS_TABS = [
  { key: "all", label: "All" },
  ...STATUS_OPTIONS.map((s) => ({ key: s.value, label: s.label })),
];

export const STATUS_TO_COLUMN = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.columnId]),
);

// Support legacy / alternate backend statuses
STATUS_TO_COLUMN.open = "todo";
STATUS_TO_COLUMN.pending = "inprogress";
STATUS_TO_COLUMN.closed = "done";

export const COLUMN_TO_STATUS = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.columnId, s.value]),
);

export const BOARD_COLUMNS = STATUS_OPTIONS.map((s) => ({
  id: s.columnId,
  title: s.label,
}));

export const STATUS_STYLES = {
  todo: { pill: "bg-slate-50 text-slate-600", border: "border-slate-300" },
  inprogress: { pill: "bg-blue-50 text-blue-600", border: "border-blue-300" },
  blocked: { pill: "bg-red-50 text-red-600", border: "border-red-300" },
  staging: {
    pill: "bg-purple-50 text-purple-600",
    border: "border-purple-300",
  },
  done: { pill: "bg-green-50 text-green-600", border: "border-green-300" },
};

export const STATUS_BADGE_CONFIG = {
  "to do": {
    variant: "secondary",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  "in progress": {
    variant: "outline",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  "on staging": {
    variant: "outline",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  blocked: {
    variant: "destructive",
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
  },
  done: {
    variant: "outline",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "closed":
    case "done":
      return "#22c55e";
    case "pending":
      return "#eab308";
    case "in progress":
      return "#3b82f6";
    default:
      return "#9E54B0";
  }
};
