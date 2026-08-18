import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMyPreferences, updateMyPreferences } from '@/api/userPreferences';

export const userPreferenceKeys = {
  all: ['user-preferences'],
  me: () => [...userPreferenceKeys.all, 'me'],
};

/**
 * Read the account's preferences once per session. `enabled` is how the auth
 * screens stay quiet — pass `false` while nobody is signed in.
 *
 * `staleTime: Infinity` on purpose: this client is the only thing that writes
 * the record, so a refetch can only ever return what we already have (or, on a
 * second device, a value the user did not change *here* — reconciling that
 * mid-session would move the UI under them).
 *
 * Because it is read exactly once, a failure is not cheap: hydration is what
 * unblocks saving light/dark, so one dropped response would mean that one
 * preference silently stops persisting for the rest of the session. Hence the
 * retries — and `components/UserPreferencesSync.jsx` treats a final failure as
 * "hydration is not coming" rather than waiting forever.
 */
export const useMyPreferences = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: userPreferenceKeys.me(),
    queryFn: getMyPreferences,
    enabled,
    staleTime: Infinity,
    retry: 2,
    retryDelay: (attempt) => 500 * 2 ** attempt,
    refetchOnWindowFocus: false,
  });

/**
 * Save a partial patch. The cache is seeded from the response rather than
 * invalidated: the server just told us the merged truth, and refetching would
 * race the next keystroke of a user clicking through Settings.
 *
 * One retry, because the caller re-queues a patch that still failed after it —
 * see `flush` in `components/UserPreferencesSync.jsx`. The PATCH is idempotent,
 * so retrying it can only ever re-send the same keys.
 */
export const useUpdateMyPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyPreferences,
    retry: 1,
    retryDelay: 1000,
    onSuccess: (result) => {
      if (result?.preferences) queryClient.setQueryData(userPreferenceKeys.me(), result);
    },
    onError: (error) => {
      // A failed save is not worth a toast — the write-through cache already
      // applied it locally, and the caller puts the patch back on the queue so
      // the next change (or the page going away) sends it again.
      console.error('Preference save failed:', error?.response?.data?.message || error?.message);
    },
  });
};
