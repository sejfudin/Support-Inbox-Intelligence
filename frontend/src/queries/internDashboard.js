import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInternDashboard, summarizeMyStandup } from '@/api/internDashboard';

// No workspace in the key: the endpoint resolves the caller's own active
// workspace server-side, and switching workspace refetches the user and
// remounts this page anyway. `lib/invalidationScopes.js` refreshes this key on
// the workspace, ticket and daily socket scopes — a status change moves the
// workload bar and the ticket order, and a standup note fills the note card.
export const internDashboardKeys = {
  all: ['intern-dashboard'],
};

export const useInternDashboard = (options = {}) =>
  useQuery({
    queryKey: internDashboardKeys.all,
    queryFn: fetchInternDashboard,
    ...options,
  });

/**
 * Summarise today's standup note.
 *
 * Writes the result straight into the cached dashboard rather than invalidating:
 * refetching the whole board to collect one string would also re-render the
 * ticket list and the workload bar, and the response already carries exactly the
 * two fields that changed. Deliberately silent on failure — the card falls back
 * to the clamped full note, which is a worse read but not a broken one, and a
 * toast for an optional convenience the intern never asked for would be noise.
 */
export const useSummarizeMyStandup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: summarizeMyStandup,
    onSuccess: ({ summary }) => {
      queryClient.setQueryData(internDashboardKeys.all, (previous) =>
        previous?.standup
          ? {
              ...previous,
              standup: { ...previous.standup, aiSummary: summary, needsSummary: false },
            }
          : previous
      );
    },
  });
};
