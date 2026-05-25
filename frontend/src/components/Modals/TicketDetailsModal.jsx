import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  User,
  X,
  Save,
  Archive,
  UserPen,
  Ticket,
  Download,
  GitPullRequest,
  MoreVertical,
  ImagePlus,
  Plus,
} from 'lucide-react';
import { useTicket, useUpdateTicket, useUploadTicketDescriptionImages } from '@/queries/tickets';
import StatusDropdown from '@/components/StatusDropdown';
import PriorityDropdown from '@/components/PriorityDropdown';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useArchiveTicket } from '@/queries/tickets';
import { useUsers } from '@/queries/users';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import AssigneesAvatar from '../Tickets/AssigneesAvatar';
import { Avatar } from '../Avatar';
import { toast } from 'sonner';
import TimeSpent from '@/components/TimeSpent';
import TicketComments from '../Tickets/TicketComments';
import TicketHistory from '../Tickets/TicketHistory';
import { dueDateToInputValue } from '@/helpers/ticketDueDate';
import { useCategories } from '@/queries/categories';
import StoryPointsField from '../StoryPointsField';
import { extractStatusId } from '@/helpers/normalizeTicket';
import { normalizeStoryPoints } from '@/helpers/storyPoints';
import { buildCsv, downloadCsvFile, formatCsvDate } from '@/helpers/csvExport';
import { PRCard } from '@/components/PRCard';
import { useRefreshPR, useUnlinkPR } from '@/queries/github';
import {
  RichTextEditor,
  RichTextEditorContent,
  RichTextEditorImageOptions,
  RichTextEditorToolbar,
} from '@/components/ui/rich-text-editor';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAiDescriptionGenerator } from '@/hooks/useAiDescriptionGenerator';
import { useAiTicketSuggestion } from '@/hooks/useAiTicketSuggestion';
import AiDescriptionPanel from '@/components/Tickets/AiDescriptionPanel';
import { Button } from '@/components/ui/button';
import { useTicketStatuses } from '@/hooks/useTicketStatuses';
import { useSocket } from '@/context/SocketContext';

const SUBJECT_PREFIX_RE = /^\s*(?:ticket\s*\d+|t\s*#?\s*\d+)\s*[:\-]\s*/i;
const sanitizeDisplaySubject = (value) =>
  String(value || '')
    .replace(SUBJECT_PREFIX_RE, '')
    .trim();

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [unlinkError, setUnlinkError] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [descriptionHoverZoom, setDescriptionHoverZoom] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('To Do');
  const [currentPriority, setCurrentPriority] = useState('medium');
  const [currentStoryPoints, setCurrentStoryPoints] = useState(null);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [dueDateInput, setDueDateInput] = useState('');
  const [currentCategory, setCurrentCategory] = useState(null);

  const [priorityLockedByUser, setPriorityLockedByUser] = useState(false);
  const [storyPointsLockedByUser, setStoryPointsLockedByUser] = useState(false);

  const { mutate: archiveTicket, isPending: isArchiving } = useArchiveTicket();
  const { mutate: refreshPR, isPending: isRefreshingPR } = useRefreshPR();
  const { mutate: unlinkPR, isPending: isUnlinkingPR } = useUnlinkPR();

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

  const descriptionInputRef = useRef(null);
  const descriptionSectionRef = useRef(null);
  const uploadDescriptionImagesMutation = useUploadTicketDescriptionImages(ticketId);
  const validateClientFiles = (files) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    for (const f of files) {
      if (!allowed.has(f.type)) {
        toast.error('Only JPG, PNG, and WEBP are allowed.');
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error('Each image must be 5MB or smaller.');
        return false;
      }
    }
    return true;
  };

  const handleDescriptionImagePick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!validateClientFiles(files)) return;

    uploadDescriptionImagesMutation.mutate(files, {
      onSuccess: (response) => {
        const uploaded = response?.data || [];
        const imageUrls = uploaded.map((img) => img?.image_url).filter(Boolean);

        if (imageUrls.length > 0) {
          const imagesHtml = imageUrls
            .map((url) => `<p><img src="${url}" alt="Description image" /></p>`)
            .join('');
          setDescription((prev) => `${prev || ''}${imagesHtml}`);
        }

        toast.success('Description image(s) uploaded.');
      },
      onError: (err) =>
        toast.error(err?.response?.data?.message || 'Failed to upload description image(s).'),
    });
  };

  const handleDescriptionImagePaste = async (file) => {
    if (!file) return null;

    if (!validateClientFiles([file])) {
      throw new Error('Invalid pasted image.');
    }

    const response = await uploadDescriptionImagesMutation.mutateAsync([file]);
    const imageUrl = response?.data?.[0]?.image_url || null;

    if (!imageUrl) {
      throw new Error('Pasted image uploaded but URL is missing.');
    }

    return imageUrl;
  };

  const handleDescriptionImageHover = (e) => {
    if (previewImageUrl) return;

    const sectionEl = descriptionSectionRef.current;
    if (!sectionEl) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('[data-description-image-zoom]')) return;

    const imageEl = target.closest('img');
    if (!imageEl || !sectionEl.contains(imageEl)) {
      setDescriptionHoverZoom(null);
      return;
    }

    const src = imageEl.getAttribute('src');
    if (!src) {
      setDescriptionHoverZoom(null);
      return;
    }

    const imageRect = imageEl.getBoundingClientRect();
    const top = Math.max(8, imageRect.top + 8);
    const left = Math.max(8, imageRect.right - 40);

    setDescriptionHoverZoom({ src, top, left });
  };

  const clearDescriptionImageHover = () => {
    setDescriptionHoverZoom(null);
  };

  useEffect(() => {
    const handleAnyScroll = () => setDescriptionHoverZoom(null);

    window.addEventListener('scroll', handleAnyScroll, true);
    return () => window.removeEventListener('scroll', handleAnyScroll, true);
  }, []);

  useEffect(() => {
    if (!socket || !isConnected || !isOpen || !ticketId) return undefined;

    socket.emit('join_ticket', { ticketId });

    return () => {
      socket.emit('leave_ticket', { ticketId });
    };
  }, [socket, isConnected, isOpen, ticketId]);

  const workspaceId =
    typeof ticket?.workspace === 'string'
      ? ticket.workspace
      : ticket?.workspace?._id || user?.workspaceId;
  const { data: categoriesData } = useCategories(workspaceId);
  const categories = categoriesData?.data || [];

  const updateField = useCallback((field, value) => {
    if (field === 'description') {
      setDescription(String(value || ''));
      return;
    }

    if (field === 'priority') {
      setCurrentPriority(String(value || 'medium'));
      return;
    }

    if (field === 'storyPoints') {
      setCurrentStoryPoints(normalizeStoryPoints(value));
    }
  }, []);

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
    subject: title,
    descriptionHtml: description,
    updateField,
  });

  const { resetSuggestionState: resetMetadataSuggestionState } = useAiTicketSuggestion({
    isOpen,
    subject: title,
    description,
    priorityLockedByUser,
    storyPointsLockedByUser,
    updateField,
    isPaused: shouldPauseMetadataSuggestion || isArchived,
    skipInitialAutoSuggestion: true,
  });

  useEffect(() => {
    if (isOpen) return;
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
    resetMetadataSuggestionState();
    resetDescriptionGenerationState();
  }, [isOpen, resetDescriptionGenerationState, resetMetadataSuggestionState]);

  useEffect(() => {
    if (!ticket || !isOpen) return;

    const displayTitle = sanitizeDisplaySubject(ticket.subject || ticket.title);
    setTitle(displayTitle || 'Untitled Task');
    setDescription(ticket.description ?? '');
    setCurrentStatus(extractStatusId(ticket.status) || helpers.defaultMainStatusId || '');
    setCurrentPriority(ticket.priority ?? 'medium');
    setCurrentStoryPoints(normalizeStoryPoints(ticket.storyPoints));

    const existingAgentIds = ticket.assignedTo?.map((a) => a._id || a) || [];
    setSelectedAgents(existingAgentIds);
    setDueDateInput(dueDateToInputValue(ticket.dueDate));
    setCurrentCategory(ticket.category?._id || ticket.category || null);
    setPriorityLockedByUser(false);
    setStoryPointsLockedByUser(false);
    resetMetadataSuggestionState();
    resetDescriptionGenerationState();
  }, [
    isOpen,
    ticket,
    helpers.defaultMainStatusId,
    resetDescriptionGenerationState,
    resetMetadataSuggestionState,
  ]);

  const selectedUsersObjects = useMemo(() => {
    return selectedAgents.map((id) => users.find((u) => u._id === id)).filter(Boolean);
  }, [selectedAgents, users]);

  const detailStatusOptions = useMemo(
    () => helpers.getDetailStatusOptions(currentStatus),
    [helpers, currentStatus]
  );

  const hasChanges = useMemo(() => {
    if (!ticket) return false;
    const initialTitle = sanitizeDisplaySubject(ticket.subject || ticket.title) || 'Untitled Task';
    const initialDescription = ticket.description ?? '';
    const initialStatus = extractStatusId(ticket.status) || helpers.defaultMainStatusId || '';
    const initialPriority = ticket.priority ?? 'medium';
    const initialStoryPoints = normalizeStoryPoints(ticket.storyPoints);
    const initialAgents = (ticket.assignedTo?.map((a) => a._id || a) || []).sort();
    const currentAgents = [...selectedAgents].sort();
    const initialDue = dueDateToInputValue(ticket.dueDate);
    const initialCategory = ticket.category?._id || ticket.category || null;
    return (
      title !== initialTitle ||
      description !== initialDescription ||
      currentStatus !== initialStatus ||
      currentPriority !== initialPriority ||
      currentStoryPoints !== initialStoryPoints ||
      dueDateInput !== initialDue ||
      currentCategory !== initialCategory ||
      JSON.stringify(initialAgents) !== JSON.stringify(currentAgents)
    );
  }, [
    ticket,
    description,
    currentStatus,
    currentPriority,
    currentStoryPoints,
    selectedAgents,
    title,
    dueDateInput,
    currentCategory,
    helpers.defaultMainStatusId,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleArchiveToggle = () => {
    setIsActionModalOpen(true);
  };

  const handleExportSingleCsv = () => {
    if (!ticket) return;

    try {
      const numericId = ticket.taskNumber ?? ticket.ticketNumber ?? null;
      const rawId = ticket.id || ticket._id || ticket.ticketId || '';
      const id = numericId != null ? numericId : rawId || 'ticket';
      const titleValue = title || ticket.subject || ticket.title || 'Untitled';
      const shortSubject = String(titleValue).slice(0, 40).trim().replace(/\s+/g, '-');

      const assignee =
        (ticket.assignedTo || [])
          .map((p) => p?.fullname || p?.fullName || p?.email || '')
          .filter(Boolean)
          .join('; ') || 'Unassigned';

      const workspaceName =
        ticket.workspace?.name ||
        ticket.workspaceName ||
        (typeof ticket.workspace === 'string' ? ticket.workspace : ticket.workspace?._id || '');

      const commentsCount =
        ticket.comments?.length ?? ticket.messages?.length ?? ticket.activity?.length ?? '';

      const header = [
        'id',
        'title',
        'description',
        'status',
        'priority',
        'assignee',
        'workspace',
        'commentsCount',
        'createdAt',
        'updatedAt',
        'dueDate',
      ];

      const row = [
        id,
        titleValue,
        description || ticket.description || '',
        helpers.resolveStatusLabel(ticket.status) ||
          helpers.resolveStatusLabel(currentStatus) ||
          '',
        ticket.priority || '',
        assignee,
        workspaceName,
        commentsCount,
        formatCsvDate(ticket.createdAt),
        formatCsvDate(ticket.updatedAt),
        ticket.dueDate || '',
      ];

      const idPart = numericId != null ? `T${numericId}` : '';
      const baseName = idPart
        ? `ticket-${idPart}-${shortSubject || 'export'}`
        : `ticket-${shortSubject || 'export'}`;
      const csv = buildCsv(header, [row]);
      downloadCsvFile(`${baseName}.csv`, csv);
      toast.success('Ticket exported to CSV.');
    } catch (err) {
      toast.error('Failed to export ticket. Please try again.');
    }
  };

  const handleRefreshPR = () => {
    if (!ticket?.linkedPullRequest) return;
    refreshPR(
      { ticketId, workspaceId: ticket?.workspace },
      {
        onSuccess: () => {
          toast.success('PR status refreshed');
        },
        onError: (error) => {
          toast.error('Failed to refresh PR', {
            description: error?.response?.data?.message || 'Please try again',
          });
        },
      }
    );
  };

  const handleUnlinkPR = () => {
    setIsUnlinkModalOpen(true);
    setUnlinkError(null);
  };

  const handleConfirmUnlink = () => {
    setUnlinkError(null);
    unlinkPR(ticketId, {
      onSuccess: () => {
        setIsUnlinkModalOpen(false);
        toast.success('PR unlinked successfully');
      },
      onError: (error) => {
        setUnlinkError(error?.response?.data?.message || 'Failed to unlink PR');
      },
    });
  };

  const handleConfirmAction = () => {
    const action = archiveTicket;
    setIsActionPending(true);
    setActionError(null);

    action(ticketId, {
      onSuccess: () => {
        setIsActionModalOpen(false);
        setIsActionPending(false);
        onClose();
        toast.success('Ticket archived', {
          description: 'The ticket has been moved to archive and is now read-only.',
        });
      },
      onError: (error) => {
        setIsActionPending(false);
        const message =
          error?.response?.data?.message || 'Failed to archive ticket. Please try again.';
        setActionError(message);
        toast.error('Action failed', {
          description: message,
        });
      },
    });
  };

  const handlePriorityChange = useCallback((value) => {
    setPriorityLockedByUser(true);
    setCurrentPriority(value);
  }, []);

  const handleStoryPointsChange = useCallback((value) => {
    setStoryPointsLockedByUser(true);
    setCurrentStoryPoints(normalizeStoryPoints(value));
  }, []);

  const handleSave = () => {
    if (!hasChanges || !ticketId) return;
    if (isGeneratingDescription) {
      toast.error('Please wait for AI generation to finish.');
      return;
    }

    if (isDescriptionDraftActive) {
      acceptGeneratedDescription();
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
        <div className="bg-card p-8 rounded-xl shadow-xl animate-pulse flex flex-col items-center gap-4">
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
        <div className="w-full max-w-md bg-card rounded-xl shadow-2xl overflow-hidden">
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
              <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-md p-3">
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
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted hover:bg-muted text-foreground transition-colors"
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:p-4 lg:p-8 transition-opacity"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[22px] bg-card shadow-2xl animate-in zoom-in-95 duration-200 max-sm:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] sm:h-[90vh] sm:max-h-none sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket details"
      >
        <div className="flex shrink-0 flex-col gap-3 border-b bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Ticket Details
            </span>
          </div>

          <div className="flex w-full flex-row flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
            {!isArchived && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted/50"
                    aria-label="Ticket actions"
                    title="Ticket actions"
                    data-test="ticket-modal-actions-trigger"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[200] min-w-[180px]">
                  <DropdownMenuItem
                    onSelect={handleExportSingleCsv}
                    disabled={!ticket}
                    className="cursor-pointer text-foreground"
                    data-test="ticket-modal-export-csv-option"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleArchiveToggle}
                    disabled={isArchiving}
                    className="cursor-pointer text-foreground"
                    data-test="ticket-modal-archive-option"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isArchiving ? 'Archiving...' : 'Archive'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!isArchived && (
              <Button
                variant="default"
                size="lg"
                type="button"
                onClick={handleSave}
                disabled={
                  updateTicketMutation.isPending ||
                  isGeneratingDescription ||
                  !hasChanges ||
                  !title.trim()
                }
                data-test="ticket-modal-save-button"
                className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm sm:w-auto sm:flex-initial ${
                  updateTicketMutation.isPending ||
                  isGeneratingDescription ||
                  !hasChanges ||
                  !title.trim()
                    ? 'cursor-not-allowed bg-muted text-muted-foreground'
                    : ''
                }`}
              >
                <Save className="w-4 h-4" />
                {updateTicketMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              className="shrink-0 p-1 ml-2 hover:bg-muted rounded text-muted-foreground hover:text-muted-foreground transition-colors"
              aria-label="Close ticket details"
              data-test="ticket-modal-close-button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <DeleteConfirmModal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            onConfirm={handleConfirmAction}
            isLoading={isActionPending}
            errorMessage={actionError}
            title="Archive Ticket"
            description="Archive this ticket? This action cannot be undone."
            confirmLabel="Archive"
            loadingLabel="Archiving..."
          />

          <DeleteConfirmModal
            isOpen={isUnlinkModalOpen}
            onClose={() => setIsUnlinkModalOpen(false)}
            onConfirm={handleConfirmUnlink}
            isLoading={isUnlinkingPR}
            errorMessage={unlinkError}
            title="Unlink Pull Request"
            description={`Unlink PR #${ticket?.linkedPullRequest?.prNumber || ''} from this ticket? This will remove the PR association but won't affect the PR itself.`}
            confirmLabel="Unlink"
            loadingLabel="Unlinking..."
          />

          <div className="group relative mb-8 flex flex-col gap-3">
            {ticket?.taskNumber && (
              <div className="flex">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground border border-border uppercase tracking-tight">
                  Ticket {ticket.taskNumber}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
              <div className="flex min-w-0 flex-1">
                <input
                  type="text"
                  value={title}
                  readOnly={isArchived}
                  onChange={(e) => setTitle(e.target.value)}
                  data-test="ticket-modal-title-input"
                  className={`w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight outline-none transition sm:text-2xl md:text-3xl lg:text-4xl ${
                    !title.trim() ? 'text-destructive' : 'text-foreground'
                  } ${
                    isArchived
                      ? 'cursor-default'
                      : 'cursor-text hover:bg-muted/50 focus:bg-muted/50 focus:border-border focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
                  }`}
                  placeholder="Enter ticket title..."
                />
              </div>

              <div
                className={`grid min-w-0 grid-cols-3 gap-2 sm:gap-3 lg:w-[420px] ${
                  isArchived ? 'pointer-events-none opacity-70' : ''
                }`}
              >
                <div className="space-y-2 min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Assignees
                  </div>

                  <Popover>
                    <PopoverTrigger asChild disabled={isArchived}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 rounded-md text-xs font-bold uppercase transition-colors outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 bg-muted text-foreground hover:bg-muted justify-between ${
                          isArchived ? 'cursor-not-allowed opacity-70 pointer-events-none' : ''
                        }`}
                        aria-label="Change assignees"
                        data-test="ticket-modal-assignees-trigger"
                      >
                        <span className="flex items-center gap-2 min-w-0 normal-case">
                          {selectedUsersObjects.length > 0 ? (
                            <>
                              <AssigneesAvatar users={selectedUsersObjects.slice(0, 3)} size="sm" />
                              <span className="min-w-0 truncate text-foreground font-semibold">
                                {selectedUsersObjects[0]?.fullName ||
                                  selectedUsersObjects[0]?.fullname ||
                                  selectedUsersObjects[0]?.email ||
                                  'Assigned'}
                              </span>
                            </>
                          ) : (
                            <>
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="text-muted-foreground font-medium whitespace-nowrap">
                                Unassigned
                              </span>
                            </>
                          )}
                        </span>

                        {selectedUsersObjects.length > 1 ? (
                          <span className="shrink-0 inline-flex items-center rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
                            +{selectedUsersObjects.length - 1}
                          </span>
                        ) : null}
                      </button>
                    </PopoverTrigger>

                    {!isArchived && (
                      <PopoverContent
                        className="w-[min(calc(100vw-2rem),18rem)] p-2 z-[110]"
                        align="center"
                        sideOffset={8}
                      >
                        <div className="space-y-1">
                          <div className="mb-1 flex items-center justify-between border-b border-separator px-2 py-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Assign Agents
                            </span>
                            {selectedAgents.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedAgents([])}
                                className="text-[10px] text-red-500 hover:underline font-bold"
                                data-test="ticket-modal-assignees-clear-button"
                              >
                                Clear all
                              </button>
                            )}
                          </div>

                          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                            {users.length > 0 ? (
                              users.map((user) => {
                                const isSelected = selectedAgents.includes(user._id);
                                return (
                                  <div
                                    key={user._id}
                                    onClick={() => {
                                      setSelectedAgents((prev) =>
                                        isSelected
                                          ? prev.filter((id) => id !== user._id)
                                          : [...prev, user._id]
                                      );
                                    }}
                                    className="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                                    data-test={`ticket-modal-assignee-option-${user._id}`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={null}
                                      className="pointer-events-none"
                                      data-test={`ticket-modal-assignee-checkbox-${user._id}`}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-semibold text-foreground truncate group-hover:text-blue-700">
                                        {user.fullName || user.fullname || user.email}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground truncate">
                                        {user.email}
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
                    )}
                  </Popover>
                </div>

                <div className="space-y-2 min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status
                  </div>
                  <StatusDropdown
                    status={currentStatus}
                    onChange={setCurrentStatus}
                    statusOptions={detailStatusOptions}
                    className="w-full justify-between"
                  />
                </div>

                <div className="space-y-2 min-w-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Priority
                  </div>
                  <PriorityDropdown
                    priority={currentPriority}
                    onChange={handlePriorityChange}
                    disabled={isArchived}
                    className="w-full justify-between"
                  />
                </div>
              </div>
            </div>

            {!title.trim() && (
              <p className="absolute -bottom-5 left-0 text-[9px] font-bold text-destructive uppercase tracking-wider mt-1">
                Title is required
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
            <div className="space-y-6 min-w-0">
              <section
                ref={descriptionSectionRef}
                className="relative rounded-2xl border border-border bg-card shadow-md overflow-hidden"
                onMouseMove={handleDescriptionImageHover}
                onMouseLeave={clearDescriptionImageHover}
              >
                <RichTextEditor
                  value={description}
                  onChange={(html) => setDescription(html)}
                  onPasteImage={handleDescriptionImagePaste}
                  className="min-h-[220px] border-0 rounded-none divide-y-0 sm:min-h-[300px] lg:min-h-[360px]"
                  editable={!isArchived}
                >
                  <div className="flex flex-col gap-2 border-b border-separator bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
                    <div className="flex shrink-0 items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Description
                      </span>
                    </div>
                    <div className="min-w-0 flex items-center gap-2 justify-end">
                      <input
                        ref={descriptionInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleDescriptionImagePick}
                        data-test="ticket-modal-description-image-file-input"
                      />
                      <button
                        type="button"
                        onClick={() => descriptionInputRef.current?.click()}
                        disabled={isArchived || uploadDescriptionImagesMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        data-test="ticket-modal-description-upload-button"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        Upload
                      </button>
                      <RichTextEditorImageOptions />
                      <div className="min-w-0 max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0">
                        <div className="w-max">
                          <RichTextEditorToolbar className="w-max flex-nowrap whitespace-nowrap p-0 sm:flex-wrap" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <RichTextEditorContent
                    className="p-3 sm:p-4"
                    data-test="ticket-modal-description-input"
                  />
                </RichTextEditor>

                {descriptionHoverZoom && (
                  <button
                    type="button"
                    data-description-image-zoom
                    data-test="ticket-modal-description-image-zoom-button"
                    className="fixed z-[230] flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
                    style={{
                      top: `${descriptionHoverZoom.top}px`,
                      left: `${descriptionHoverZoom.left}px`,
                    }}
                    onClick={() => {
                      setPreviewImageUrl(descriptionHoverZoom.src);
                      setDescriptionHoverZoom(null);
                    }}
                    aria-label="Preview description image"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}

                {previewImageUrl && (
                  <div
                    className="fixed inset-0 z-[220] bg-black/85 flex items-center justify-center p-4"
                    onClick={() => setPreviewImageUrl(null)}
                  >
                    <button
                      type="button"
                      className="absolute top-4 right-4 rounded-full bg-card p-2"
                      onClick={() => setPreviewImageUrl(null)}
                      aria-label="Close image preview"
                      data-test="ticket-modal-description-preview-close-button"
                    >
                      <X className="w-5 h-5 text-foreground" />
                    </button>
                    <img
                      src={previewImageUrl}
                      alt="Description preview"
                      className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <AiDescriptionPanel
                  isVisible={!isArchived && isPromptPanelVisible}
                  promptLength={promptLength}
                  canGenerateDescription={canGenerateDescription}
                  isGeneratingDescription={isGeneratingDescription}
                  isDescriptionDraftActive={isDescriptionDraftActive}
                  onGenerate={() => generateDescription({ showToast: true })}
                  onAccept={acceptGeneratedDescription}
                  onCancel={cancelGeneratedDescription}
                  disabled={updateTicketMutation.isPending || isArchived}
                />
              </section>

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

            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <Accordion
                type="single"
                collapsible
                className="rounded-2xl border border-border bg-card shadow-md overflow-hidden"
              >
                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger
                    className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
                    data-test="ticket-modal-details-accordion-trigger"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Details
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Due date
                          </span>
                        </div>
                        <input
                          type="date"
                          value={dueDateInput}
                          disabled={isArchived}
                          onChange={(e) => setDueDateInput(e.target.value)}
                          data-test="ticket-modal-due-date-input"
                          className={`h-10 w-full rounded-md border border-transparent bg-muted px-3 text-sm font-semibold text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
                            isArchived ? 'cursor-not-allowed opacity-70' : ''
                          }`}
                        />
                      </div>

                      <StoryPointsField
                        value={currentStoryPoints}
                        onChange={handleStoryPointsChange}
                        disabled={isArchived}
                        className="space-y-3"
                      />
                    </div>

                    {categories.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Category
                        </span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            type="button"
                            disabled={isArchived}
                            onClick={() => setCurrentCategory(null)}
                            data-test="ticket-modal-category-option-none"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                              currentCategory === null
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted text-muted-foreground border-border hover:bg-muted'
                            } ${isArchived ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            None
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat._id}
                              type="button"
                              disabled={isArchived}
                              onClick={() => setCurrentCategory(cat._id)}
                              data-test={`ticket-modal-category-option-${cat._id}`}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                currentCategory === cat._id
                                  ? 'text-background border-transparent'
                                  : 'bg-muted text-foreground border-border hover:bg-muted'
                              } ${isArchived ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                              style={
                                currentCategory === cat._id
                                  ? { backgroundColor: cat.color, borderColor: cat.color }
                                  : {}
                              }
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    currentCategory === cat._id
                                      ? 'rgba(255,255,255,0.7)'
                                      : cat.color,
                                }}
                              />
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion
                type="single"
                collapsible
                className="rounded-2xl border border-border bg-card shadow-md overflow-hidden"
              >
                <AccordionItem value="tracking" className="border-none">
                  <AccordionTrigger
                    className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
                    data-test="ticket-modal-tracking-accordion-trigger"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Tracking
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                      <TimeSpent ticket={ticket} statusTracksTime={helpers.statusTracksTime} />

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Created By
                          </span>
                        </div>

                        <div className="flex min-h-[44px] w-full items-center gap-3 px-1.5 py-2">
                          {ticket?.creator ? (
                            <Avatar users={[ticket.creator]} size="md" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                          )}

                          <div className="flex flex-col justify-center min-w-0">
                            <span className="text-sm font-semibold text-foreground leading-none truncate">
                              {ticket?.creator?.fullname ||
                                ticket?.creator?.fullName ||
                                'Unknown User'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium mt-1">
                              {ticket?.createdAt
                                ? format(new Date(ticket.createdAt), 'MMM d, yyyy')
                                : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {ticket?.linkedPullRequest && (
                <Accordion
                  type="single"
                  collapsible
                  className="rounded-2xl border border-border bg-card shadow-md overflow-hidden"
                >
                  <AccordionItem value="pr" className="border-none">
                    <AccordionTrigger
                      className="px-4 py-3 border-b border-separator bg-muted/30 gap-2 hover:no-underline hover:bg-muted/60"
                      data-test="ticket-modal-pr-accordion-trigger"
                    >
                      <div className="flex items-center gap-2">
                        <GitPullRequest className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Linked Pull Request
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-5 pt-4 data-[state=closed]:hidden">
                      <PRCard
                        pr={ticket.linkedPullRequest}
                        onRefresh={handleRefreshPR}
                        isRefreshing={isRefreshingPR}
                        onUnlink={handleUnlinkPR}
                        isUnlinking={isUnlinkingPR}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
