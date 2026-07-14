/**
 * Drops all cached data tied to the previous signed-in user (logout / login as
 * another account). A full wipe is deliberate: every query key that survives an
 * account switch is a chance to show one user's data to another (this bit us
 * with the intern directory), and the only cost is refetching a few small
 * reference lists after login.
 */
export const clearSessionQueries = (queryClient) => {
  queryClient.clear();
};
