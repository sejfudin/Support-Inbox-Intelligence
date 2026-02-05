import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, User, CircleDot, X, Save,
  Trash2 } from "lucide-react";
import { useDeleteTicket, useTicket, useUpdateTicket } from "@/queries/tickets";
import StatusDropdown from "@/components/StatusDropdown";
import { DeleteConfirmModal } from './DeleteConfirmModal';

export const TicketDetailsModal = ({ ticketId, isOpen, onClose }) => {
  const [description, setDescription] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [currentStatus, setCurrentStatus] = useState("To Do");

const { data: apiResponse, isLoading, isError, error } = useTicket(ticketId);
  const updateTicketMutation = useUpdateTicket();

  const ticket = apiResponse?.data ?? apiResponse;

  useEffect(() => {
    if (!ticket || !isOpen) return;

    setDescription(ticket.description ?? "");
    setCurrentStatus(ticket.status ?? "To Do");
  }, [isOpen, ticket?.id, ticket?.description, ticket?.status]);

  const hasChanges =
    !!ticket &&
    (description !== (ticket.description ?? "") ||
      currentStatus !== (ticket.status ?? "To Do"));

  const task = useMemo(
    () => ({
      title: ticket?.subject || ticket?.title || "Untitled Task",
      assignee: ticket?.assignedTo?.[0]?.email?.charAt(0)?.toUpperCase() || "NA",
      dateStart: ticket?.createdAt ? format(new Date(ticket.createdAt), "MMM d") : "Start",
      dateDue: ticket?.dueDate ? format(new Date(ticket.dueDate), "MMM d") : "Due",
    }),
    [ticket?.subject, ticket?.title, ticket?.assignedTo, ticket?.createdAt, ticket?.dueDate]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);
  const {mutate: deleteTicket, isPending:isDeleting} = useDeleteTicket();
    
  const handleConfirmDelete = () => {
    deleteTicket(ticketId, {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        onClose(); 
        },
      onError: (error) => {
        setDeleteError(error?.response?.data?.message || "Failed to delete ticket. Please try again.");
      }
      });
    };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleSave = () => {
    if (!hasChanges || !ticketId) return;

    updateTicketMutation.mutate(
      {
        ticketId,
        updates: {
          status: currentStatus,
          description,
        },
      },
      {
        onSuccess: () => onClose?.(),
        onError: (error) => {
          console.error("Failed to save:", error);
          alert("Failed to save changes.");
        },
      }
    );
  };

  if (!isOpen || !ticketId) return null;

  if (isLoading) {
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

    if (isError) {
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
              Please try again. If the issue persists, check your connection or contact support.
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
        <div className="flex-1 overflow-y-auto px-12 py-10">

          <DeleteConfirmModal 
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            isLoading={isDeleting}
            errorMessage={deleteError}
          />
          <h1 className="text-4xl font-bold text-gray-900 mb-10 tracking-tight">
            {task.title}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 pb-10 border-b border-gray-100">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <CircleDot className="w-4 h-4" /> Status
              </div>

              <StatusDropdown
                status={currentStatus}
                onChange={(newStatus) => setCurrentStatus(newStatus)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <User className="w-4 h-4" /> Assignees
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-blue-500 shadow-sm">
                  {task.assignee}
                </div>
                <span className="text-sm text-gray-600 font-medium">Assigned to you</span>
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <Calendar className="w-4 h-4" /> Dates
              </div>
              <div className="text-sm text-gray-700 font-medium bg-gray-50 w-fit px-3 py-1.5 rounded-md border border-gray-100">
                {task.dateStart} <span className="text-gray-300 mx-2">→</span> {task.dateDue}
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