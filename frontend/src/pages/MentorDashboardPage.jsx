import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageSection, PageShell } from '@/components/PageShell';
import { useAuth } from '@/context/AuthContext';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MentorInternsCard } from '@/components/mentor/dashboard/MentorInternsCard';
import { MentorTicketsCard } from '@/components/mentor/dashboard/MentorTicketsCard';
import { MentorNotesCard } from '@/components/mentor/dashboard/MentorNotesCard';
import { QuickActionsCard } from '@/components/admin/dashboard/QuickActionsCard';
import { InternPickerModal } from '@/components/admin/dashboard/InternPickerModal';
import { NewMentorNoteDialog } from '@/components/admin/dashboard/NewMentorNoteDialog';
import LazyNewTickets from '@/components/Tickets/LazyNewTickets';
import TicketDetailsModal from '@/components/Modals/LazyTicketDetailsModal';
import { useTicketModals } from '@/hooks/useTicketModals';
import { useTicketModalTitle } from '@/hooks/useTicketModalTitle';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { ROLES } from '@/helpers/roles';

// Two columns: the two list cards stacked on the left, quick actions + notes
// in the rail — same split the admin/intern boards use between their main
// content and a narrower rail.
const GRID_CLASS = 'grid grid-cols-1 gap-4 xl:grid-cols-3';

/**
 * A mentor's `/dashboard` — replaces the old `UserDashboard.jsx` (just an
 * assigned-tickets table). Deliberately simpler than the admin board it
 * borrows its shell from: no hero stat cards, no activity feeds — just the
 * mentor's interns, their ticket work, notes sent to them, and quick actions.
 *
 * Every data source here is already scoped server-side to the caller
 * (`GET /api/interns` for a mentor filters to primary/secondary, tickets to
 * the active workspace, notifications to the recipient) — this page only
 * assembles them, no new backend aggregate.
 */
export default function MentorDashboardPage() {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId || '';

  // Which quick action is open — one value, so two modals can never stack.
  // `write-note` is the only two-stage action here: pick an intern, then the
  // note form opens for them.
  const [openAction, setOpenAction] = useState(null);
  const [pickedIntern, setPickedIntern] = useState(null);
  const closeAction = () => {
    setOpenAction(null);
    setPickedIntern(null);
  };

  const { selectedTicketId, isDetailsOpen, openTicketDetails, closeTicketDetails } =
    useTicketModals();
  // The details modal is page state, not a route — put the open ticket's name in
  // the tab title and restore the page's own title on close, same as the intern
  // board does.
  useTicketModalTitle({ ticketId: selectedTicketId, isOpen: isDetailsOpen });

  const { helpers: ticketStatusHelpers } = useTicketStatuses(workspaceId);

  const handleQuickAction = (key) => {
    if (key === 'assign-ticket' && !workspaceId) {
      toast.info('Pick an active workspace first', {
        description: 'Assigning a ticket needs a workspace to create it into.',
      });
      return;
    }
    setOpenAction(key);
  };

  const handleInternPicked = (intern) => {
    setPickedIntern(intern);
    setOpenAction('note-form');
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Capped to the viewport, not just floored at it (PageShell's own
          min-height): a mentor's board is meant to be read at a glance. The
          two list cards below page through their rows (4 at a time) instead of
          growing, so it normally fits with no scrollbar. `overflow-hidden` on
          the shell keeps any overflow from reaching the fixed sidebar's
          account footer; the inner `overflow-y-auto` is the fallback so a
          short viewport (or the 125% UI-size setting) can still scroll to the
          rail's Notes card rather than clipping it unreachably. */}
      <PageShell className="max-h-[var(--app-vh)] overflow-hidden">
        <PageSection className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <DashboardHeader user={user} />

          <div className={cn(GRID_CLASS, 'min-h-0 flex-1')}>
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
              <MentorInternsCard />
              <MentorTicketsCard
                hasWorkspace={Boolean(workspaceId)}
                onOpenTicket={openTicketDetails}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <QuickActionsCard role={ROLES.MENTOR} onAction={handleQuickAction} />
              <MentorNotesCard />
            </div>
          </div>
        </PageSection>
      </PageShell>

      <LazyNewTickets
        isOpen={openAction === 'assign-ticket'}
        onClose={closeAction}
        workspaceId={workspaceId}
        statusOptions={ticketStatusHelpers?.statusOptions || []}
        initialStatus={ticketStatusHelpers?.defaultMainStatusId}
      />

      <InternPickerModal
        open={openAction === 'write-note'}
        onClose={closeAction}
        onSelect={handleInternPicked}
        actionLabel="Add note"
        title="Write a note"
        description="Pick the intern the note is about — the note opens next."
        restrictToRecommendable={false}
      />

      <NewMentorNoteDialog
        internUserId={pickedIntern?.userId}
        open={openAction === 'note-form'}
        onClose={closeAction}
      />

      <TicketDetailsModal
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={closeTicketDetails}
        onOpenTicket={openTicketDetails}
      />
    </TooltipProvider>
  );
}
