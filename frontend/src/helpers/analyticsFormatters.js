export const ANALYTICS_PERIODS = [7, 15, 30];

export const formatShortDate = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const formatTooltipDate = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export const throughputChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(220 90% 56%)",
  },
};

export const creationChartConfig = {
  created: {
    label: "Created",
    color: "hsl(152 70% 35%)",
  },
};

export const cycleChartConfig = {
  avgDays: {
    label: "Avg Days",
    color: "hsl(39 92% 50%)",
  },
};
