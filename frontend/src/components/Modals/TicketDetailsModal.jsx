import { useEffect, useMemo } from 'react';
import { Archive, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTicket, useUpdateTicket } from '@/queries/tickets';
import { useUsers } from '@/queries/users';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useCategories } from '@/queries/categories';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useAiDescriptionGenerator } from '@/hooks/useAiDescriptionGenerator';
import { useAiTicketSuggestion } from '@/hooks/useAiTicketSuggestion';
import { useModalBehavior } from '@/hooks/useModalBehavior';
import { useTicketArchiveActions } from '@/hooks/useTicketArchiveActions';
import { useTicketPrActions } from '@/hooks/useTicketPrActions';
import { useDescriptionImages } from '@/hooks/useDescriptionImages';
import { useTicketDetailsFormState } from '@/hooks/useTicketDetailsFormState';
import { exportTicketToCsv } from '@/helpers/ticketCsvExport';
import TicketComments from '@/components/Tickets/TicketComments';
import TicketHistory from '@/components/Tickets/TicketHistory';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { TicketModalHeader } from './TicketDetailsModal/TicketModalHeader';
import { TicketTitleField } from './TicketDetailsModal/TicketTitleField';
import { TicketDescriptionEditor } from './TicketDetailsModal/TicketDescriptionEditor';
import { TicketMetaRail } from './TicketDetailsModal/TicketMetaRail';
import { TicketPrAccordion } from './TicketDetailsModal/TicketPrAccordion';

export const TicketDetailsModal = ({
  ticketId,
  isOpen,
  onClose,
  focusCommentId = null,
  focusRequestToken = null,
  onFocusConsumed = null,
}) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const { data: apiResponse, isLoading, isError, error } = useTicket(ticketId);
  const updateTicketMutation = useUpdateTicket();
  const ticket = apiResponse?.data ?? apiResponse;
  const isArchived = Boolean(ticket?.isArchived);
  const workspaceIdForStatuses = ticket?.workspace || user?.workspaceId;
  const { helpers } = useTicketStatuses(workspaceIdForStatuses);

  const {
    data: usersData,
    isLoading: usersLoading,
    isError: usersError,
  } = useUsers({
    pagination: false,
    workspaceId: ticket?.workspace || user?.workspaceId,
  });
  const users = usersData?.users || [];

  const workspaceId =
    typeof ticket?.workspace === 'string'
      ? ticket.workspace
      : ticket?.workspace?._id || user?.workspaceId;
  const { data: categoriesData } = useCategories(workspaceId);
  const categories = categoriesData?.data || [];

  const {
    title,
    setTitle,
    description,
    setDescription,
    currentStatus,
    setCurrentStatus,
    currentPriority,
    currentStoryPoints,
    selectedAgents,
    setSelectedAgents,
    dueDateInput,
    setDueDateInput,
    currentCategory,
    setCurrentCategory,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
    handlePriorityChange,
    handleStoryPointsChange,
    hasChanges,
  } = useTicketDetailsFormState(ticket, isOpen, helpers);

  const descriptionImages = useDescriptionImages(ticketId, setDescription);

  useEffect(() => {
    if (!socket || !isConnected || !isOpen || !ticketId) return undefined;

    socket.emit('join_ticket', { ticketId });

    return () => {
      socket.emit('leave_ticket', { ticketId });
    };
  }, [socket, isConnected, isOpen, ticketId]);

  const aiDescription = useAiDescriptionGenerator({
    isOpen,
    subject: title,
    descriptionHtml: description,
    updateField,
  });
  const { resetDescriptionGenerationState } = aiDescription;

  const { resetSuggestionState: resetMetadataSuggestionState } = useAiTicketSuggestion({
    isOpen,
    subject: title,
    description,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
    isPaused: aiDescription.shouldPauseMetadataSuggestion || isArchived,
    skipInitialAutoSuggestion: true,
    enableAutoSuggestion: false,
  });

  useEffect(() => {
    if (isOpen) return;
    resetMetadataSuggestionState();
    resetDescriptionGenerationState();
  }, [isOpen, resetMetadataSuggestionState, resetDescriptionGenerationState]);

  useEffect(() => {
    if (!ticket || !isOpen) return;
    resetMetadataSuggestionState();
    resetDescriptionGenerationState();
  }, [
    isOpen,
    ticket,
    helpers.defaultMainStatusId,
    resetMetadataSuggestionState,
    resetDescriptionGenerationState,
  ]);

  const selectedUsersObjects = useMemo(
    () => selectedAgents.map((id) => users.find((u) => u._id === id)).filter(Boolean),
    [selectedAgents, users]
  );

  const detailStatusOptions = useMemo(
    () => helpers.getDetailStatusOptions(currentStatus),
    [helpers, currentStatus]
  );

  useModalBehavior(isOpen, onClose);

  const archiveActions = useTicketArchiveActions(ticketId, onClose);
  const prActions = useTicketPrActions(ticketId, ticket);

  const handleExportSingleCsv = () => {
    if (!ticket) return;

    try {
      exportTicketToCsv(ticket, { title, description, currentStatus, helpers });
      toast.success('Ticket exported to CSV.');
    } catch (err) {
      toast.error('Failed to export ticket. Please try again.');
    }
  };

  const handleSave = () => {
    if (!hasChanges || !ticketId) return;
    if (aiDescription.isGeneratingDescription) {
      toast.error('Please wait for AI generation to finish.');
      return;
    }

    if (aiDescription.isDescriptionDraftActive) {
      aiDescription.acceptGeneratedDescription();
    }

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: {
          subject: title,
          statusId: currentStatus,
          priority: currentPriority,
          storyPoints: currentStoryPoints,
          description,
          assignedTo: selectedAgents,
          dueDate: dueDateInput ? new Date(`${dueDateInput}T12:00:00`).toISOString() : null,
          category: currentCategory,
        },
      },
      {
        onSuccess: () => {
          onClose?.();
          toast.success('Ticket updated', {
            description: 'Your changes have been saved successfully.',
          });
        },
        onError: (error) => {
          toast.error('Update failed', {
            description: error?.response?.data?.message || 'Could not save changes.',
          });
        },
      }
    );
  };

  if (!isOpen || !ticketId) return null;

  if (isLoading || usersLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
        <div className="bg-card p-8 rounded-[var(--r-card)] shadow-elevated animate-pulse flex flex-col items-center gap-4">
          <div className="h-6 w-48 bg-muted rounded"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  if (!ticket) return null;

  if (isError || usersError) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md bg-card rounded-[var(--r-card)] shadow-elevated overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="text-sm font-bold text-foreground uppercase tracking-widest">
              Ticket Details
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-muted-foreground transition-colors"
              aria-label="Close error modal"
              data-test="ticket-modal-error-close-button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Failed to load ticket</h2>

            <p className="text-sm text-muted-foreground">
              Please try again. If the issue persists, check your connection or contact support.
            </p>

            {error?.message && (
              <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-[var(--r-control)] p-3">
                {error.message}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-4 py-2 rounded-[var(--r-control)] text-[12.5px] font-semibold bg-muted hover:bg-muted text-foreground transition-colors"
                data-test="ticket-modal-error-dismiss-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] transition-opacity sm:p-4 lg:p-8"
      onClick={onClose}
      role="presentation"
    >
      {/* 1020px and content-height, per the mockup — it was 1320×92vh, which left
          the meta column stranded from the description and forced a tall empty
          modal on short tickets. */}
      <div
        className="flex max-h-full w-full max-w-[1020px] flex-col overflow-hidden rounded-[var(--r-card)] border border-separator bg-card shadow-elevated duration-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket details"
      >
        <TicketModalHeader
          isArchived={isArchived}
          ticket={ticket}
          onExportCsv={handleExportSingleCsv}
          onArchiveToggle={archiveActions.handleArchiveToggle}
          isArchiving={archiveActions.isArchiving}
          onSave={handleSave}
          isSaveDisabled={
            updateTicketMutation.isPending ||
            aiDescription.isGeneratingDescription ||
            !hasChanges ||
            !title.trim()
          }
          isSaving={updateTicketMutation.isPending}
          onRestore={archiveActions.handleRestore}
          isUnarchiving={archiveActions.isUnarchiving}
          onClose={onClose}
          currentStatus={currentStatus}
          onStatusChange={setCurrentStatus}
          statusOptions={detailStatusOptions}
          statusBadgeConfig={helpers.statusBadgeConfig}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DeleteConfirmModal
            isOpen={archiveActions.isActionModalOpen}
            onClose={() => archiveActions.setIsActionModalOpen(false)}
            onConfirm={archiveActions.handleConfirmAction}
            isLoading={archiveActions.isActionPending}
            errorMessage={archiveActions.actionError}
            title="Archive Ticket"
            description="Archive this ticket? You can restore it later from the Archive page."
            confirmLabel="Archive"
            loadingLabel="Archiving..."
          />

          <DeleteConfirmModal
            isOpen={prActions.isUnlinkModalOpen}
            onClose={() => prActions.setIsUnlinkModalOpen(false)}
            onConfirm={prActions.handleConfirmUnlink}
            isLoading={prActions.isUnlinkingPR}
            errorMessage={prActions.unlinkError}
            title="Unlink Pull Request"
            description={`Unlink PR #${ticket?.linkedPullRequest?.prNumber || ''} from this ticket? This will remove the PR association but won't affect the PR itself.`}
            confirmLabel="Unlink"
            loadingLabel="Unlinking..."
          />

          {isArchived && (
            <div
              className="flex items-center gap-2 border-b border-separator bg-muted/50 px-5 py-3 text-[12.5px] text-muted-foreground"
              data-test="ticket-modal-archived-banner"
            >
              <Archive className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold text-foreground">Archived</span> — read-only record.
                Restore to edit.
              </span>
            </div>
          )}

          {/* The mockup's body: a flexible content column beside a fixed 300px
              meta rail, divided by the card outline. */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-4 border-border px-5 pb-[22px] pt-[18px] lg:border-r">
              <TicketTitleField title={title} onTitleChange={setTitle} isArchived={isArchived} />

              <TicketDescriptionEditor
                isArchived={isArchived}
                description={description}
                setDescription={setDescription}
                descriptionSectionRef={descriptionImages.descriptionSectionRef}
                descriptionInputRef={descriptionImages.descriptionInputRef}
                handleDescriptionImageHover={descriptionImages.handleDescriptionImageHover}
                clearDescriptionImageHover={descriptionImages.clearDescriptionImageHover}
                handleDescriptionImagePick={descriptionImages.handleDescriptionImagePick}
                handleDescriptionImagePaste={descriptionImages.handleDescriptionImagePaste}
                uploadDescriptionImagesMutation={descriptionImages.uploadDescriptionImagesMutation}
                descriptionHoverZoom={descriptionImages.descriptionHoverZoom}
                previewImageUrl={descriptionImages.previewImageUrl}
                setPreviewImageUrl={descriptionImages.setPreviewImageUrl}
                aiDescription={aiDescription}
                isSavePending={updateTicketMutation.isPending}
              />

              <TicketComments
                ticketId={ticketId}
                isArchived={isArchived}
                users={users}
                focusCommentId={focusCommentId}
                focusRequestToken={focusRequestToken}
                onFocusConsumed={onFocusConsumed}
              />

              <TicketHistory ticketId={ticketId} />
            </div>

            <TicketMetaRail
              ticket={ticket}
              isArchived={isArchived}
              users={users}
              selectedAgents={selectedAgents}
              setSelectedAgents={setSelectedAgents}
              selectedUsersObjects={selectedUsersObjects}
              currentPriority={currentPriority}
              onPriorityChange={handlePriorityChange}
              currentStoryPoints={currentStoryPoints}
              onStoryPointsChange={handleStoryPointsChange}
              dueDateInput={dueDateInput}
              onDueDateChange={setDueDateInput}
              categories={categories}
              currentCategory={currentCategory}
              onCategoryChange={setCurrentCategory}
              statusTracksTime={helpers.statusTracksTime}
            >
              {ticket?.linkedPullRequest && (
                <TicketPrAccordion
                  linkedPullRequest={ticket.linkedPullRequest}
                  isArchived={isArchived}
                  onRefresh={prActions.handleRefreshPR}
                  isRefreshing={prActions.isRefreshingPR}
                  onUnlink={prActions.handleUnlinkPR}
                  isUnlinking={prActions.isUnlinkingPR}
                />
              )}
            </TicketMetaRail>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
