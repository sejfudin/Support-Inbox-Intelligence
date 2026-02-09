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
} from "lucide-react";
import {  useTicket, useUpdateTicket } from "@/queries/tickets";
import StatusDropdown from "@/components/StatusDropdown";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { useArchiveTicket } from "@/queries/tickets";
import { useUsers } from "@/queries/users";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import AssigneesAvatar from "../Tickets/AssigneesAvatar";

export const TicketDetailsModal = ({ ticketId, isOpen, onClose }) => {
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

  const { data: usersData, isLoading: usersLoading, isError:usersError } = useUsers({ pagination: false });
  const users = usersData?.users || [];

  useEffect(() => {
    if (!ticket || !isOpen) return;

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
    const initialDescription = ticket.description ?? "";
    const initialStatus = ticket.status ?? "To Do";
    const initialAgents = (ticket.assignedTo?.map(a => a._id || a) || []).sort();
    const currentAgents = [...selectedAgents].sort();
    return (
      description !== initialDescription ||
      currentStatus !== initialStatus ||
      JSON.stringify(initialAgents) !== JSON.stringify(currentAgents)   
    );
  }, [ticket, description, currentStatus, selectedAgents]);

  const task = useMemo(
    () => ({
      title: ticket?.subject || ticket?.title || "Untitled Task",
      dateStart: ticket?.createdAt ? format(new Date(ticket.createdAt), "MMM d") : "Start",
      dateDue: ticket?.dueDate ? format(new Date(ticket.dueDate), "MMM d") : "Due",
    }),
    [ticket],
  );

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
      },
      onError: (error) => {
        setIsActionPending(false);
        setActionError(
          error?.response?.data?.message ||
            `Failed to archive ticket. Please try again.`,
        );
      },
    });
  };

  const handleSave = () => {
    if (!hasChanges || !ticketId) return;

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: {
          status: currentStatus,
          description,
          assignedTo: selectedAgents, 
        },
      },
      {
        onSuccess: () => onClose?.(),
        onError: (error) => {
          console.error("Failed to save:", error);
          alert("Failed to save changes.");
        },
      },
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 transition-opacity"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[1200px] bg-white h-[90vh] rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket details"
      >
        <div className="flex items-center justify-between px-8 py-4 border-b bg-white">
          <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-3">
            {!isArchived && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                  isArchiving
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
              >
                <Archive className="w-4 h-4" />
                {isArchiving ? "Archiving..." : "Archive"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={updateTicketMutation.isPending || !hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                updateTicketMutation.isPending || !hasChanges
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              <Save className="w-4 h-4" />
              {updateTicketMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-12 py-10">
          <DeleteConfirmModal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            onConfirm={handleConfirmAction}
            isLoading={isActionPending}
            errorMessage={actionError}
            title="Archive Ticket"
            description="Archive this ticket? You can restore it later from Backlog."
            confirmLabel="Archive"
            loadingLabel="Archiving..."
          />

          <h1 className="text-4xl font-bold text-gray-900 mb-10 tracking-tight whitespace-pre-wrap break-words">
            {task.title}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 pb-10 border-b border-gray-100">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <CircleDot className="w-4 h-4" /> Status
              </div>

              <StatusDropdown
                status={currentStatus}
                onChange={setCurrentStatus}
              />
            </div>

          <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <User className="w-4 h-4" /> Assignees
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-xl border border-transparent transition-all min-h-[44px] w-fit">
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
              </Popover>
            </div>

            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <Calendar className="w-4 h-4" /> Dates
              </div>
              <div className="text-sm text-gray-700 font-medium bg-gray-50 w-fit px-3 py-1.5 rounded-md border border-gray-100">
                {task.dateStart} <span className="text-gray-300 mx-2">→</span>{" "}
                {task.dateDue}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">
                Description
              </div>
              <div className="text-[10px] text-blue-500 font-medium uppercase bg-blue-50 px-2 py-0.5 rounded">
                Editor Mode
              </div>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write something more..."
              className="w-full border border-gray-200 rounded-xl p-8 min-h-[400px] text-gray-800 bg-white text-lg leading-relaxed shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all resize-none font-sans"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
