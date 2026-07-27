// Interns eligible for a new standup entry: the daily's active-intern pool
// (from the API) minus anyone who already has an entry today.
export const getAvailableInterns = (daily) => {
  const coveredMemberIds = new Set((daily?.entries ?? []).map((entry) => String(entry.member._id)));

  return (daily?.activeInterns ?? []).filter((intern) => !coveredMemberIds.has(String(intern._id)));
};
