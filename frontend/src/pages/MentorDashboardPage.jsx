import { useState } from 'react';
import { toast } from 'sonner';
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
      <PageShell>
        <PageSection className="space-y-5">
          <DashboardHeader user={user} />

          <div className={GRID_CLASS}>
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
      />
    </TooltipProvider>
  );
}
