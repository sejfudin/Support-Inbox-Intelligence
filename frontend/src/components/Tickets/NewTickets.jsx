import { useRef, useState } from 'react';
import { useCreateTicket } from '@/queries/tickets';
import { useAiTicketSuggestion } from '@/hooks/useAiTicketSuggestion';
import {
  RichTextEditor,
  RichTextEditorContent,
  RichTextEditorToolbar,
} from '@/components/ui/rich-text-editor';
import { useUsers } from '@/queries/users';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTicketForm } from '@/hooks/useTicketForm';
import { useCategories } from '@/queries/categories';
import { toast } from 'sonner';
import { Sparkles, User, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAiDescriptionGenerator } from '@/hooks/useAiDescriptionGenerator';
import { htmlToPlainText } from '@/helpers/aiDescriptionPrompt';
import { templateTextToDescriptionHtml } from '@/helpers/ticketDescriptionTemplates';
import AiDescriptionPanel from '@/components/Tickets/AiDescriptionPanel';
import BlockedByField from '@/components/Tickets/BlockedByField';
import { emptyBlocker, isBlockedStatusId, toBlockerPayload } from '@/helpers/ticketBlocker';
import StatusDropdown from '@/components/StatusDropdown';
import PriorityDropdown from '@/components/PriorityDropdown';
import StoryPointsField from '@/components/StoryPointsField';
import AssigneesAvatar from '@/components/Tickets/AssigneesAvatar';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CHIP } from '@/helpers/badgeTones';

/**
 * Category chip geometry, taken from `helpers/badgeTones` so these sit at the
 * same radius-6 as every other badge. Identical to the migrated detail modal's
 * `TicketCategoryField` — a workspace picks the colours itself, so they arrive
 * as data and go through `style` while the geometry stays shared.
 */
const CHIP_BASE = cn(CHIP, 'cursor-pointer transition-colors');
const CHIP_IDLE = 'border border-separator text-muted-foreground hover:text-foreground';

/**
 * The three dropdowns in the details panel are the app-wide shared triggers,
 * which still carry the pre-library 40px bold-uppercase pill. This is the same
 * override the migrated detail modal's meta rail uses: pin them to the
 * library's 32px control, sentence case. Scoped by the `-trigger` data-test
 * suffix so the category chips below keep the shared chip styling.
 */
const PANEL_TRIGGERS = cn(
  '[&_[data-test$="-trigger"]]:h-[var(--h-md)] [&_[data-test$="-trigger"]]:rounded-[var(--r-control)]',
  '[&_[data-test$="-trigger"]]:border [&_[data-test$="-trigger"]]:border-border',
  '[&_[data-test$="-trigger"]]:bg-card [&_[data-test$="-trigger"]]:px-[var(--px-md)]',
  '[&_[data-test$="-trigger"]]:py-0',
  '[&_[data-test$="-trigger"]]:text-[length:var(--fs-control)] [&_[data-test$="-trigger"]]:font-medium',
  '[&_[data-test$="-trigger"]]:normal-case'
);

const NewTickets = ({
  isOpen,
  onClose,
  initialStatus,
  hideStatus = false,
  workspaceId: previewWorkspaceId,
  statusOptions = [],
  contextNote,
}) => {
  const createMutation = useCreateTicket();
  const { user } = useAuth();

  const effectiveWorkspaceId = previewWorkspaceId || user?.workspaceId;
  const { data: usersData } = useUsers({ pagination: false, workspaceId: effectiveWorkspaceId });
  const users = usersData?.users || [];

  const { data: categoriesData } = useCategories(effectiveWorkspaceId);
  const categories = categoriesData?.data || [];

  const resolvedInitialStatus = initialStatus ?? statusOptions[0]?.value ?? '';
  const { form: newTicket, updateField, resetForm } = useTicketForm(resolvedInitialStatus);

  const isBlockedSelected = !hideStatus && isBlockedStatusId(statusOptions, newTicket.status);

  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [priorityLockedByUser, setPriorityLockedByUser] = useState(false);
  const [storyPointsLockedByUser, setStoryPointsLockedByUser] = useState(false);
  const [descriptionEditorKey, setDescriptionEditorKey] = useState(0);
  const appliedTemplateHtmlRef = useRef('');

  const {
    isPromptPanelVisible,
    promptLength,
    canGenerateDescription,
    isGeneratingDescription,
    isDescriptionDraftActive,
    shouldPauseMetadataSuggestion,
    generateDescription,
    acceptGeneratedDescription,
    cancelGeneratedDescription,
    resetDescriptionGenerationState,
  } = useAiDescriptionGenerator({
    isOpen,
    subject: newTicket.subject,
    descriptionHtml: newTicket.description,
    updateField,
  });

  const {
    hasSuggestibleInput,
    isSuggesting,
    requestManualSuggestion,
    resetSuggestionState: resetMetadataSuggestionState,
  } = useAiTicketSuggestion({
    isOpen,
    subject: newTicket.subject,
    description: newTicket.description,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
    isPaused: shouldPauseMetadataSuggestion,
  });

  const resetSuggestionState = () => {
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
    appliedTemplateHtmlRef.current = '';
    resetMetadataSuggestionState();
    resetDescriptionGenerationState();
  };

  const handleUseAiSuggestion = () => {
    if (shouldPauseMetadataSuggestion || !hasSuggestibleInput || isSuggesting) return;
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
    requestManualSuggestion();
  };

  const handleDialogOpenChange = (open) => {
    if (open) return;
    resetSuggestionState();
    onClose();
  };

  const handleCreate = (e) => {
    e.preventDefault();

    if (isGeneratingDescription) {
      toast.error('Please wait for AI generation to finish.');
      return;
    }

    if (isDescriptionDraftActive) {
      acceptGeneratedDescription();
    }

    const plainDescription = htmlToPlainText(newTicket.description).trim();
    if (!plainDescription) {
      toast.error('Description is required.');
      return;
    }

    const ticketData = {
      ...newTicket,
      assignedTo: Array.isArray(newTicket.assignedTo) ? newTicket.assignedTo : [],
      workspaceId: effectiveWorkspaceId,
    };

    // `hideStatus` only hides the picker UI (below) — it must not also drop the
    // resolved status from the payload. It used to: a create from a page that
    // hides the picker (Backlog) discarded `initialStatus` entirely here, so the
    // backend fell back to a role-based default status instead of Backlog's,
    // and the new ticket silently landed on Tickets/Board rather than staying
    // in Backlog.
    if (ticketData.status) {
      ticketData.statusId = ticketData.status;
      delete ticketData.status;
    } else {
      delete ticketData.status;
      delete ticketData.statusId;
    }

    // A blocker only travels with a Blocked ticket. Switching the status back and
    // forth keeps what was typed (a misclick shouldn't lose it), so what the form
    // holds is filtered here rather than cleared as the dropdown moves.
    if (isBlockedSelected) {
      ticketData.blockedBy = toBlockerPayload(newTicket.blockedBy);
    } else {
      delete ticketData.blockedBy;
    }

    if (ticketData.dueDate) {
      ticketData.dueDate = new Date(`${ticketData.dueDate}T12:00:00`).toISOString();
    } else {
      delete ticketData.dueDate;
    }

    createMutation.mutate(ticketData, {
      onSuccess: () => {
        toast.success('Ticket created', {
          description: `"${newTicket.subject}" has been added to the system.`,
        });
        resetForm();
        resetSuggestionState();
        onClose();
      },
      onError: (error) => {
        toast.error('Failed to create ticket', {
          description:
            error?.response?.data?.message || 'Please check your connection and try again.',
        });
      },
    });
  };

  const currentAssignees = Array.isArray(newTicket.assignedTo) ? newTicket.assignedTo : [];

  const handleAgentToggle = (userId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentAssignees.includes(userId)) {
      updateField(
        'assignedTo',
        currentAssignees.filter((id) => id !== userId)
      );
    } else {
      updateField('assignedTo', [...currentAssignees, userId]);
    }
  };

  const replaceDescriptionFromCategory = (descriptionHtml) => {
    updateField('description', descriptionHtml);
    setDescriptionEditorKey((key) => key + 1);
  };

  const handleCategoryChange = (category) => {
    const appliedTemplateHtml = appliedTemplateHtmlRef.current;

    if (!category) {
      updateField('category', null);

      if (appliedTemplateHtml && newTicket.description === appliedTemplateHtml) {
        replaceDescriptionFromCategory('');
      }

      appliedTemplateHtmlRef.current = '';
      return;
    }

    const templateHtml = templateTextToDescriptionHtml(category.descriptionTemplate);
    updateField('category', category._id);

    if (templateHtml) {
      replaceDescriptionFromCategory(templateHtml);
    } else if (appliedTemplateHtml && newTicket.description === appliedTemplateHtml) {
      replaceDescriptionFromCategory('');
    }

    appliedTemplateHtmlRef.current = templateHtml;
  };

  const selectedUsersObjects = users.filter((u) => currentAssignees.includes(u._id));
  const isSubmitting = createMutation.isPending || isGeneratingDescription;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex h-[92vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[var(--r-card)] bg-card p-0 shadow-2xl animate-in zoom-in-95 duration-200 max-sm:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] sm:h-[min(88vh,760px)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[var(--r-card)] [&>button]:hidden">
        <DialogTitle className="sr-only">New Ticket</DialogTitle>

        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-separator bg-card px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
            {/* `contextNote` names the target workspace when the modal is opened
                from somewhere that is not the workspace's own ticket board — an
                admin who manages several should not have to guess where this
                ticket is about to land. Sentence case: `contextNote` is a
                sentence ("New ticket in Acme"), not an eyebrow. */}
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {contextNote || 'New Ticket'}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              tabIndex={-1}
              onClick={() => handleDialogOpenChange(false)}
              aria-label="Close new ticket modal"
              data-test="ticket-new-close-button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {/* The subject is this modal's title, so it takes the migrated
                detail modal's `TicketTitleField` treatment: 20px/600 on no
                chrome at rest, rather than its own card border and accent
                ring at 24px. */}
            <div className="mb-5">
              <input
                type="text"
                value={newTicket.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                required
                placeholder="Enter ticket subject…"
                className="-mx-2 w-full min-w-0 cursor-text text-pretty rounded-[var(--r-control)] border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold leading-[1.25] tracking-[-0.015em] text-foreground outline-none transition placeholder:text-muted-foreground/75 hover:bg-accent/50 focus:border-border focus:bg-accent/50"
                data-test="ticket-new-subject-input"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:flex-1 lg:min-h-0 lg:items-stretch lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
              <section className="flex flex-col rounded-[var(--r-card)] border border-border bg-card shadow-md overflow-hidden min-h-[360px] sm:min-h-[440px] lg:h-full lg:min-h-0">
                <RichTextEditor
                  key={descriptionEditorKey}
                  value={newTicket.description}
                  onChange={(html) => updateField('description', html)}
                  placeholder="Describe the ticket… (type /ai to generate a first draft)"
                  className="flex-1 lg:h-full min-h-0 border-0 rounded-none divide-y-0"
                >
                  <div className="flex flex-col gap-2 border-b border-separator bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Description
                      </span>
                    </div>
                    <div
                      tabIndex={-1}
                      className="min-w-0 max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0 outline-none"
                    >
                      <div className="w-max">
                        <RichTextEditorToolbar className="w-max flex-nowrap whitespace-nowrap p-0 sm:flex-wrap" />
                      </div>
                    </div>
                  </div>
                  <RichTextEditorContent
                    className="p-3 sm:p-4"
                    data-test="ticket-new-description-input"
                  />
                </RichTextEditor>

                <AiDescriptionPanel
                  isVisible={isPromptPanelVisible}
                  promptLength={promptLength}
                  canGenerateDescription={canGenerateDescription}
                  isGeneratingDescription={isGeneratingDescription}
                  isDescriptionDraftActive={isDescriptionDraftActive}
                  onGenerate={() => generateDescription({ showToast: true })}
                  onAccept={acceptGeneratedDescription}
                  onCancel={cancelGeneratedDescription}
                  disabled={createMutation.isPending}
                />
              </section>

              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <div className="rounded-[var(--r-card)] border border-border bg-card shadow-md overflow-hidden">
                  <div className="border-b border-separator bg-muted/30 px-4 py-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Details
                    </span>
                  </div>

                  <div className={cn('space-y-4 px-4 pb-5 pt-4', PANEL_TRIGGERS)}>
                    <div
                      className={cn(
                        'grid gap-3 sm:gap-6',
                        hideStatus ? 'grid-cols-1' : 'grid-cols-2'
                      )}
                    >
                      <Field label="Assignees" className="min-w-0">
                        <Popover
                          open={assigneePopoverOpen}
                          onOpenChange={setAssigneePopoverOpen}
                          modal
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 rounded-[var(--r-control)] text-xs font-bold uppercase transition-colors outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-foreground hover:bg-muted justify-between"
                              aria-label="Change assignees"
                              data-test="ticket-new-assignees-trigger"
                            >
                              <span className="flex items-center gap-2 min-w-0 normal-case">
                                {selectedUsersObjects.length > 0 ? (
                                  <>
                                    <AssigneesAvatar
                                      users={selectedUsersObjects.slice(0, 3)}
                                      size="sm"
                                    />
                                    <span className="min-w-0 truncate text-foreground font-semibold">
                                      {selectedUsersObjects[0]?.fullName ||
                                        selectedUsersObjects[0]?.fullname ||
                                        selectedUsersObjects[0]?.email ||
                                        'Assigned'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground font-medium whitespace-nowrap">
                                      Unassigned
                                    </span>
                                  </>
                                )}
                              </span>
                              {selectedUsersObjects.length > 1 && (
                                <span className="shrink-0 inline-flex items-center rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
                                  +{selectedUsersObjects.length - 1}
                                </span>
                              )}
                            </button>
                          </PopoverTrigger>

                          <PopoverContent
                            className="w-[min(calc(100vw-2rem),18rem)] p-2 z-[200]"
                            align="start"
                            sideOffset={8}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1">
                              <div className="mb-1 flex items-center justify-between border-b border-separator px-2 py-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Assign Agents
                                </span>
                                {currentAssignees.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      updateField('assignedTo', []);
                                    }}
                                    className="text-[10px] text-[hsl(var(--tone-danger))] hover:underline font-bold"
                                    data-test="ticket-new-assignees-clear-button"
                                  >
                                    Clear all
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[250px] overflow-y-auto">
                                {users.length > 0 ? (
                                  users.map((listUser) => {
                                    const isSelected = currentAssignees.includes(listUser._id);
                                    return (
                                      <div
                                        key={listUser._id}
                                        onClick={(e) => handleAgentToggle(listUser._id, e)}
                                        className="flex items-center gap-3 p-2 hover:bg-[hsl(var(--tone-info)/0.5)] rounded-[var(--r-control)] cursor-pointer transition-colors group"
                                        data-test={`ticket-new-assignee-option-${listUser._id}`}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          className="pointer-events-none"
                                          onCheckedChange={() => {}}
                                          data-test={`ticket-new-assignee-checkbox-${listUser._id}`}
                                        />
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-semibold text-foreground truncate group-hover:text-[hsl(var(--tone-info-fg))]">
                                            {listUser.fullName ||
                                              listUser.fullname ||
                                              listUser.email}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground truncate">
                                            {listUser.email}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="p-4 text-center text-xs text-muted-foreground">
                                    No users found
                                  </div>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </Field>

                      {!hideStatus && (
                        <Field label="Status" className="min-w-0">
                          <StatusDropdown
                            status={newTicket.status}
                            onChange={(val) => updateField('status', val)}
                            statusOptions={statusOptions}
                            className="w-full justify-between"
                          />
                        </Field>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {/* One combined label for the pair, so it cannot go
                          through `Field` — the Suggest control sits in the same
                          row, and a button inside a `<label>` is not a label.
                          The caption is `Field`'s own type. */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium leading-none text-muted-foreground">
                          Priority & story points
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          tabIndex={-1}
                          onClick={handleUseAiSuggestion}
                          disabled={!hasSuggestibleInput || isSuggesting}
                          title="AI suggest priority & story points"
                          data-test="ticket-new-ai-suggest-button"
                        >
                          <Sparkles className={cn(isSuggesting && 'animate-pulse')} />
                          Suggest
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-6 items-center">
                        <div className="space-y-2 min-w-0">
                          <PriorityDropdown
                            priority={newTicket.priority}
                            onChange={(val) => {
                              setPriorityLockedByUser(true);
                              updateField('priority', val);
                            }}
                            className="w-full justify-between"
                          />
                        </div>

                        <StoryPointsField
                          value={newTicket.storyPoints}
                          hideLabel
                          onChange={(val) => {
                            setStoryPointsLockedByUser(true);
                            updateField('storyPoints', val);
                          }}
                          className="space-y-2 min-w-0"
                        />
                      </div>
                    </div>

                    <Field label="Due date" htmlFor="ticket-new-due-date">
                      <Input
                        id="ticket-new-due-date"
                        type="date"
                        value={newTicket.dueDate}
                        onChange={(e) => updateField('dueDate', e.target.value)}
                        data-test="ticket-new-due-date-input"
                      />
                    </Field>

                    {categories.length > 0 && (
                      <Field label="Category">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCategoryChange(null)}
                            className={cn(
                              CHIP_BASE,
                              newTicket.category === null
                                ? 'border border-transparent bg-foreground text-background'
                                : CHIP_IDLE
                            )}
                            data-test="ticket-new-category-option-none"
                          >
                            None
                          </button>
                          {categories.map((cat) => {
                            const active = newTicket.category === cat._id;
                            return (
                              <button
                                key={cat._id}
                                type="button"
                                onClick={() => handleCategoryChange(cat)}
                                data-test={`ticket-new-category-option-${cat._id}`}
                                className={cn(
                                  CHIP_BASE,
                                  active ? 'border border-transparent' : CHIP_IDLE
                                )}
                                style={
                                  active
                                    ? { color: cat.color, backgroundColor: `${cat.color}1f` }
                                    : undefined
                                }
                              >
                                {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                    )}
                  </div>
                </div>

                {isBlockedSelected && (
                  <BlockedByField
                    value={newTicket.blockedBy}
                    onChange={(next) => updateField('blockedBy', next)}
                    workspaceId={effectiveWorkspaceId}
                    idPrefix="new-ticket-blocker"
                  />
                )}
              </aside>
            </div>
          </div>

          <div className="shrink-0 border-t border-separator bg-card px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex w-full items-center justify-end gap-2">
              {/* A modal confirm is the one place the library gives a button
                  `lg`. One primary in the row; Cancel is the secondary. */}
              <Button
                variant="secondary"
                size="lg"
                type="button"
                onClick={() => handleDialogOpenChange(false)}
                data-test="ticket-new-cancel-button"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={isSubmitting}
                data-test="ticket-new-submit-button"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Ticket'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewTickets;
