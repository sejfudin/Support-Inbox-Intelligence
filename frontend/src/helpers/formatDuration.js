export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "-";

  const d = Math.floor(seconds / 86400);
  if (d > 0) return `${d}d`;

  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}h`;

  const m = Math.floor(seconds / 60);
  if (m > 0) return `${m}m`;

  if (seconds > 0) return "<1m";

  return "-";
};
