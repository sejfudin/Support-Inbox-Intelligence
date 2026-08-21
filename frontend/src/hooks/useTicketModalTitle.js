import { useLocation } from 'react-router-dom';
import { useTicket } from '@/queries/tickets';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { resolveRouteTitle } from '@/helpers/pageTitle';

/**
 * Puts the open ticket's title in the browser tab, on any of the pages that open
 * the details modal.
 *
 * The modal is page state, not a route — the pathname never changes when it opens
 * or closes — so `RouteTitle` cannot do this, and the page has to put its own
 * title back on close. That fallback is the route's baseline title, so a page
 * only has to say *that* it opens tickets, not what it is called.
 *
 * Reads the same query key the modal renders from, so it costs no extra request.
 */
export function useTicketModalTitle({ ticketId, isOpen }) {
  const { pathname } = useLocation();
  const { data } = useTicket(isOpen ? ticketId : undefined);
  const ticket = data?.data ?? data;

  useDocumentTitle(isOpen ? ticket?.title : resolveRouteTitle(pathname));
}

export default useTicketModalTitle;
