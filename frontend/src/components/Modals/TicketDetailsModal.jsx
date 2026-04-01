import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  User,
  CircleDot,
  X,
  Save,
  Trash2,
  Archive,
  ArchiveRestore,
  UserPen,
  Ticket,
} from "lucide-react";
import { useTicket, useUpdateTicket } from "@/queries/tickets";
import StatusDropdown from "@/components/StatusDropdown";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { useArchiveTicket } from "@/queries/tickets";
import { useUsers } from "@/queries/users";
import { useAuth } from "@/context/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";
import { Avatar } from "../Avatar";
import { toast } from "sonner";
import TicketComments from "../Tickets/TicketComments";

export const TicketDetailsModal = ({ ticketId, isOpen, onClose }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [currentStatus, setCurrentStatus] = useState("To Do");
  const [selectedAgents, setSelectedAgents] = useState([]); 

  const { mutate: archiveTicket, isPending: isArchiving } = useArchiveTicket();

  const { data: apiResponse, isLoading, isError, error } = useTicket(ticketId);
  const updateTicketMutation = useUpdateTicket();
  const ticket = apiResponse?.data ?? apiResponse;

  const { data: usersData, isLoading: usersLoading, isError:usersError } = useUsers({
    pagination: false,
    workspaceId: ticket?.workspace || user?.workspaceId,
  });
  const users = usersData?.users || [];

  useEffect(() => {
    if (!ticket || !isOpen) return;

    setTitle(ticket.subject || ticket.title || "Untitled Task");
    setDescription(ticket.description ?? "");
    setCurrentStatus(ticket.status ?? "To Do");

    const existingAgentIds = ticket.assignedTo?.map(a => a._id || a) || [];
      setSelectedAgents(existingAgentIds);    
  }, 
  [isOpen, ticket]);

  const selectedUsersObjects = useMemo(() => {
    return selectedAgents
      .map(id => users.find(u => u._id === id))
      .filter(Boolean);
  }, 
  [selectedAgents, users]);

  const hasChanges = useMemo(() => {
    if (!ticket) return false;
    const initialTitle = ticket.subject || ticket.title || "Untitled Task";
    const initialDescription = ticket.description ?? "";
    const initialStatus = ticket.status ?? "To Do";
    const initialAgents = (ticket.assignedTo?.map(a => a._id || a) || []).sort();
    const currentAgents = [...selectedAgents].sort();
    return (
      title !== initialTitle ||
      description !== initialDescription ||
      currentStatus !== initialStatus ||
      JSON.stringify(initialAgents) !== JSON.stringify(currentAgents)   
    );
  }, [ticket, description, currentStatus, selectedAgents, title]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const isArchived = Boolean(ticket?.isArchived);

  const handleArchiveToggle = () => {
    setIsActionModalOpen(true);
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
        toast.success("Ticket archived", {
          description: "The ticket has been moved to archive and is now read-only.",
        });
      },
      onError: (error) => {
        setIsActionPending(false);
        const message = error?.response?.data?.message || "Failed to archive ticket. Please try again.";
        setActionError(message);
        toast.error("Action failed", {
          description: message,
        });
      },
    });
  };

  const handleSave = () => {
    if (!hasChanges || !ticketId) return;

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: {
          subject: title,
          status: currentStatus,
          description,
          assignedTo: selectedAgents, 
        },
      },
     {
    onSuccess: () => {
      onClose?.(); 
      toast.success("Ticket updated", {
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast.error("Update failed", {
        description: error?.response?.data?.message || "Could not save changes.",
      });
    },
  }
    );
  };

  if (!isOpen || !ticketId) return null;

  if (isLoading || usersLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-xl shadow-xl animate-pulse flex flex-col items-center gap-4">
          <div className="h-6 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }
  if (!ticket) return null;

  if (isError || usersError) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="text-sm font-bold text-gray-700 uppercase tracking-widest">
              Ticket Details
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close error modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Failed to load ticket
            </h2>

            <p className="text-sm text-gray-600">
              Please try again. If the issue persists, check your connection or
              contact support.
            </p>

            {error?.message && (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                {error.message}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 lg:p-8 transition-opacity"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:h-[90vh] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket details"
      >
        <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close ticket details"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Ticket Details
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {!isArchived && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm sm:w-auto ${
                  isArchiving
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
              >
                <Archive className="w-4 h-4" />
                {isArchiving ? "Archiving..." : "Archive"}
              </button>
            )}
            {!isArchived && (
            <button
              type="button"
              onClick={handleSave}
              disabled={updateTicketMutation.isPending || !hasChanges || !title.trim()}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm sm:w-auto ${
                updateTicketMutation.isPending || !hasChanges || !title.trim()
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              <Save className="w-4 h-4" />
              {updateTicketMutation.isPending ? "Saving..." : "Save Changes"}
            </button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
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

          <div className="group relative mb-10">
            <input
              type="text"
              value={title}
              readOnly={isArchived}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full rounded-md border-none bg-transparent p-0 text-2xl font-bold tracking-tight outline-none transition-all hover:bg-accent/50 focus:ring-0 sm:text-3xl lg:text-4xl ${
                !title.trim() ? "text-destructive" : "text-foreground"
              }`}
              placeholder="Enter ticket title..."
            />
            
            <div className={`absolute -bottom-1 left-0 h-0.5 transition-all duration-150 ${
              !title.trim() 
                ? "w-full bg-destructive" 
                : "w-0 group-focus-within:w-full bg-blue-600" 
            }`}></div>
            
            {!title.trim() && (
              <p className="absolute -bottom-5 left-0 text-[9px] font-bold text-destructive uppercase tracking-wider mt-1 animate-in fade-in slide-in-from-top-1">
                Title is required
              </p>
            )}
          </div>

          <div className="mb-10 grid grid-cols-1 gap-6 border-b border-gray-100 pb-8 sm:grid-cols-2 lg:gap-8 xl:grid-cols-4 xl:pb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <CircleDot className="w-4 h-4" /> Status
              </div>
            <div className={isArchived ? "pointer-events-none opacity-70" : ""}>
              <StatusDropdown
                status={currentStatus}
                onChange={setCurrentStatus}
              />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <User className="w-4 h-4" /> Assignees
              </div>

              <Popover>
                <PopoverTrigger asChild disabled={isArchived}>
                  <div 
                    className={`flex items-center gap-3 p-1.5 rounded-xl border border-transparent transition-all min-h-[44px] w-fit ${
                      isArchived 
                        ? "cursor-not-allowed opacity-70 pointer-events-none"
                        : "cursor-pointer hover:bg-gray-50"
                    }`}
                  >
                    {selectedUsersObjects.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <AssigneesAvatar users={selectedUsersObjects} />
                        <span className="text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                          {selectedUsersObjects.length}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="text-sm text-gray-400 italic">Unassigned</span>
                      </div>
                    )}
                  </div>
                </PopoverTrigger>

                {!isArchived && (
                  <PopoverContent className="w-72 p-2 z-[110]" align="start">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assign Agents</span>
                        {selectedAgents.length > 0 && (
                          <button onClick={() => setSelectedAgents([])} className="text-[10px] text-red-500 hover:underline font-bold">Clear all</button>
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
                                  setSelectedAgents(prev => 
                                    isSelected ? prev.filter(id => id !== user._id) : [...prev, user._id]
                                  );
                                }}
                                className="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group"
                              >
                                <Checkbox checked={isSelected} onCheckedChange={null} className="pointer-events-none" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-blue-700">
                                    {user.fullName || user.fullname || user.email}
                                  </span>
                                  <span className="text-[10px] text-gray-400 truncate">{user.email}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-gray-400">No users found</div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            </div>
            <div className="space-y-3 sm:col-span-2 xl:col-span-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                <UserPen className="w-4 h-4" /> Created By
              </div>

              <div className="flex min-h-[44px] w-full items-center gap-3 p-1.5 sm:w-fit">
                {ticket?.creator ? (
                  <Avatar users={[ticket.creator]} />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                )}

                <div className="flex flex-col justify-center">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {ticket?.creator?.fullname || ticket?.creator?.fullName || "Unknown User"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-1">
                    {ticket?.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 h-[50vh] min-h-[400px]">
            <div className="flex-[2] flex flex-col space-y-4">
              <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">
                Description
              </div>  
              <textarea
                value={description}
                readOnly={isArchived}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write something more..."
                className="flex-1 w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-base leading-relaxed text-gray-800 shadow-sm outline-none transition-all focus:border-blue-200 focus:ring-4 focus:ring-blue-50 lg:p-8 lg:text-lg"
            />
            </div>
            <div className="flex-[1] min-w-[320px]">
                  <TicketComments ticketId={ticketId} isArchived={isArchived} />
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
