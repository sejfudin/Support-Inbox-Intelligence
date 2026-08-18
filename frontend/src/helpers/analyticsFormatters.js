export const ANALYTICS_PERIODS = [7, 15, 30];

export const formatShortDate = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const formatTooltipDate = (value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const throughputChartConfig = {
  completed: {
    label: 'Completed',
    color: 'hsl(var(--tone-info))',
  },
};

export const creationChartConfig = {
  created: {
    label: 'Created',
    color: 'hsl(var(--tone-success))',
  },
};

export const cycleChartConfig = {
  avgDays: {
    label: 'Avg Days',
    color: 'hsl(var(--tone-warning))',
  },
};
