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
  // trick: the page mounts and fires its queries the moment auth resolves, while the mark is
  // still up. Over one full turn of the animation that is usually all the time the page needs, so
  // the splash lifts onto a screen that is already filled in — rather than playing over nothing
  // and handing over to a screenful of skeletons.
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
      {!loading && <Outlet />}
    </>
  );
};

export default ProtectedRoute;
