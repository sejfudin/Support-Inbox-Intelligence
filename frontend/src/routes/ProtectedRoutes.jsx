import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Loader, useLoaderHold } from '@/components/ui/loader';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const showSplash = useLoaderHold(loading);

  // The guards only run once the user is known — before that there is nothing to compare a role
  // against, and redirecting on a half-resolved session would bounce a signed-in person to
  // /login on every reload.
  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  // The splash is an overlay over `<Outlet />`, not a replacement for it, and that is the whole
  // trick: the page mounts and fires its queries *while* auth is still resolving, so the splash
  // lifts onto a screen that is already filled in rather than handing over to a screenful of
  // skeletons. It has to mount during the wait, not after it — gating the Outlet on `!loading`
  // gave the overlap only on a fast boot, and on the slow boot the whole thing exists for the
  // mark lifted at the same moment the page appeared.
  //
  // Mounting a protected page before the session is known is safe here because `loading` is
  // `isLoadingUser && !!token` (see AuthContext): it is only ever true when a token is already
  // in storage, so this cannot flash a protected screen at a signed-out visitor — that path has
  // `loading === false` and is caught by the guard above. Queries scoped to the person still
  // wait, since their `enabled` reads a `user` that has not landed; what does get done in the
  // window is the route chunk, the shell, and every fetch that needs no identity.
  //
  // The route guards inside the Outlet must hold rather than redirect while `loading` is true —
  // a guard that reads `user?.workspaceId` sees `undefined` here and would bounce the person off
  // the URL they asked for. See `AppRoutes.jsx`.
  //
  // What it deliberately does NOT do is wait for every query to settle. An earlier version gated
  // on `useIsFetching()`, which sounds stricter and is worse: it parked a full-screen brand
  // animation over pages like the admin user list, whose entire content is a paginated table with
  // a perfectly good skeleton of its own. A page that can draw its own wait should be allowed to.
  // So the splash covers the boot — auth and the shell — and anything still outstanding after
  // that belongs to the component that owns it.
  //
  // The veil stays translucent rather than opaque, on purpose: the shell and the first cards are
  // visible enough behind the mark to show that something is being put together, which reads very
  // differently from a blank screen with a logo on it.
  return (
    <>
      {showSplash && <Loader variant="screen" size="lg" label="Loading your workspace" />}
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
