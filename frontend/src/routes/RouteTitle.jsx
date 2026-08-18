import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatPageTitle, resolveRouteTitle } from '@/helpers/pageTitle';

/**
 * Applies the route's baseline tab title on every navigation. Rendered once, next
 * to `<Routes>`.
 *
 * It runs in a *layout* effect on purpose: React flushes every layout effect
 * before any passive effect in the same commit, so a page that overrides the
 * title with a loaded record's name (`useDocumentTitle`, a plain `useEffect`)
 * always wins, whichever order the two components mount in.
 */
export default function RouteTitle() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    document.title = formatPageTitle(resolveRouteTitle(pathname));
  }, [pathname]);

  return null;
}
