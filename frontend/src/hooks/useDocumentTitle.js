import { useEffect } from 'react';
import { formatPageTitle } from '@/helpers/pageTitle';

/**
 * Sets the browser-tab title for a page that names one specific thing — the
 * ticket, workspace or person it is showing.
 *
 * Pass a falsy value while the data is still loading: the route's baseline title
 * (see `helpers/pageTitle.js`) stays up instead of the tab flashing "undefined".
 * There is no cleanup on unmount — the next route sets its own title, and
 * restoring the previous one would race with it.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return;
    document.title = formatPageTitle(title);
  }, [title]);
}

export default useDocumentTitle;
