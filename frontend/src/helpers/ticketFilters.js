import { PRIORITY_OPTIONS } from "./ticketPriority";

export const PRIORITY_FILTER_VALUES = {
  ALL: "all",
};

export const ASSIGNEE_FILTER_VALUES = {
  ALL: "all",
  UNASSIGNED: "unassigned",
};

export const PRIORITY_ORDER_VALUES = {
  NONE: "none",
  DESC: "desc",
  ASC: "asc",
};

export const PRIORITY_FILTER_OPTIONS = [
  { value: PRIORITY_FILTER_VALUES.ALL, label: "All priorities" },
  ...PRIORITY_OPTIONS.map((priority) => ({
    value: priority.value,
    label: priority.label,
  })),
];

export const PRIORITY_ORDER_OPTIONS = [
  { value: PRIORITY_ORDER_VALUES.NONE, label: "Default" },
  { value: PRIORITY_ORDER_VALUES.DESC, label: "Highest first" },
  { value: PRIORITY_ORDER_VALUES.ASC, label: "Lowest first" },
];

export const DUE_DATE_ORDER_VALUES = {
  DEFAULT: "default",
  SOONEST: "soonest",
  LATEST: "latest",
};

export const DUE_DATE_ORDER_OPTIONS = [
  { value: DUE_DATE_ORDER_VALUES.DEFAULT, label: "Default" },
  { value: DUE_DATE_ORDER_VALUES.SOONEST, label: "Soonest first" },
  { value: DUE_DATE_ORDER_VALUES.LATEST, label: "Latest first" },
];

export const DEFAULT_TICKET_CONTROLS = {
  priorities: [],
  assigneeIds: [],
  priorityOrder: PRIORITY_ORDER_VALUES.NONE,
  dueDateOrder: DUE_DATE_ORDER_VALUES.DEFAULT,
};

const PRIORITY_VALUE_SET = new Set(
  PRIORITY_OPTIONS.map((priority) => priority.value.toLowerCase()),
);

const unique = (list = []) => Array.from(new Set(list.filter(Boolean)));

const normalizeLower = (value) => String(value || "").trim().toLowerCase();

const sanitizePriorities = (values = []) =>
  unique((Array.isArray(values) ? values : []).map(normalizeLower)).filter((value) =>
    PRIORITY_VALUE_SET.has(value),
  );

const sanitizeAssigneeIds = (values = []) =>
  unique(
    (Array.isArray(values) ? values : [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && id !== ASSIGNEE_FILTER_VALUES.ALL),
  );

const sanitizePriorityOrder = (value) => {
  const safe = normalizeLower(value || PRIORITY_ORDER_VALUES.NONE);
  return Object.values(PRIORITY_ORDER_VALUES).includes(safe)
    ? safe
    : PRIORITY_ORDER_VALUES.NONE;
};

const sanitizeDueDateOrder = (value) => {
  const safe = normalizeLower(value || DUE_DATE_ORDER_VALUES.DEFAULT);
  return Object.values(DUE_DATE_ORDER_VALUES).includes(safe)
    ? safe
    : DUE_DATE_ORDER_VALUES.DEFAULT;
};

export const serializeCsvParam = (values, { lowercase = false } = {}) => {
  const safe = unique(
    (Array.isArray(values) ? values : [])
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .map((v) => (lowercase ? v.toLowerCase() : v)),
  );
  return safe.join(",");
};

const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === "string") return user;
  return user._id || user.id || null;
};

export const buildAssigneeFilterOptions = (users = []) => {
  const base = [
    { value: ASSIGNEE_FILTER_VALUES.ALL, label: "All assignees" },
    { value: ASSIGNEE_FILTER_VALUES.UNASSIGNED, label: "Unassigned" },
  ];

  const uniqueUsers = new Map();

  users.forEach((user) => {
    const id = getUserId(user);
    if (!id) return;

    const label = user.fullname || user.fullName || user.email || "Unknown user";
    uniqueUsers.set(String(id), { value: String(id), label });
  });

  return [...base, ...Array.from(uniqueUsers.values())];
};

export const buildTicketQueryParamsFromControls = (controls = {}) => {
  const priorities = sanitizePriorities(controls.priorities);
  const assigneeIds = sanitizeAssigneeIds(controls.assigneeIds);
  const priorityOrder = sanitizePriorityOrder(controls.priorityOrder);
  const dueDateOrder = sanitizeDueDateOrder(controls.dueDateOrder);

  const params = {};

  if (priorities.length > 0) {
    params.priorities = serializeCsvParam(priorities, { lowercase: true });
  }

  if (assigneeIds.length > 0) {
    params.assigneeIds = serializeCsvParam(assigneeIds);
  }

  if (priorityOrder !== PRIORITY_ORDER_VALUES.NONE) {
    params.priorityOrder = priorityOrder;
  }

  params.sortBy = "dueDate";
  params.sortOrder =
    dueDateOrder === DUE_DATE_ORDER_VALUES.SOONEST ? "asc" : "desc";

  return params;
};
