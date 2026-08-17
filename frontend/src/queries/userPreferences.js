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
 */
export const useMyPreferences = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: userPreferenceKeys.me(),
    queryFn: getMyPreferences,
    enabled,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

/**
 * Save a partial patch. The cache is seeded from the response rather than
 * invalidated: the server just told us the merged truth, and refetching would
 * race the next keystroke of a user clicking through Settings.
 */
export const useUpdateMyPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyPreferences,
    onSuccess: (result) => {
      if (result?.preferences) queryClient.setQueryData(userPreferenceKeys.me(), result);
    },
    onError: (error) => {
      // A failed save is not worth a toast — the write-through cache already
      // applied it locally and the next change retries the whole patch.
      console.error('Preference save failed:', error?.response?.data?.message || error?.message);
    },
  });
};
