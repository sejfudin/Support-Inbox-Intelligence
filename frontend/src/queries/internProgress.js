import { useQuery } from '@tanstack/react-query';
import { fetchInternProgress } from '@/api/internProgress';

// One key for the whole page: the endpoint is a single aggregate, and
// `lib/invalidationScopes.js` refreshes it on the `intern:all` socket scope — which
// is what every write behind this page emits (an evaluation recorded, a readiness
// level set, a recommendation advanced). Renaming this key silently kills that
// refresh, so it is imported there rather than re-typed.
export const internProgressKeys = {
  all: ['intern-progress'],
};

/**
 * The intern's own programme record. Read-only — there is no mutation hook in this
 * module and no endpoint to hang one off; evaluations, readiness and
 * recommendations are all admin-authored (see `server/routes/dashboard.js`).
 */
export const useInternProgress = (options = {}) =>
  useQuery({
    queryKey: internProgressKeys.all,
    queryFn: fetchInternProgress,
    ...options,
  });
