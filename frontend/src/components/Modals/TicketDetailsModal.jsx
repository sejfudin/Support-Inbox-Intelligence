import React, { useState } from 'react';
import { format } from 'date-fns'; 
import { 
  Calendar, User, CircleDot, X, Save,
  Archive
} from 'lucide-react';
import { useArchiveTicket, useTicket, useUnarchiveTicket } from '@/queries/tickets';
import { TicketStatusBadge } from '@/components/StatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export const TicketDetailsModal = ({ ticketId, isOpen, onClose }) => {
  const [descriptionDraft, setDescriptionDraft] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data: apiResponse, isLoading } = useTicket(ticketId);
  const { mutate: archiveTicket, isPending: isArchiving } = useArchiveTicket();
  const { mutate: unarchiveTicket, isPending: isUnarchiving } = useUnarchiveTicket();

  if (!isOpen || !ticketId) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-lg shadow-xl animate-pulse">Loading details...</div>
      </div>
    );
  }

  const ticket = apiResponse?.data || apiResponse;
  const isArchived = Boolean(ticket?.isArchived);
  const isActionPending = isArchiving || isUnarchiving;
  const ticketDescription = ticket?.description || "";
  const description = descriptionDraft ?? ticketDescription;

  const handleClose = () => {
    setDescriptionDraft(null);
    onClose();
  };

  const handleConfirmAction = () => {
    const action = isArchived ? unarchiveTicket : archiveTicket;

    action(ticketId, {
      onSuccess: () => {
        setIsActionModalOpen(false);
        handleClose();
      },
      onError: (error) => {
        setActionError(
          error?.response?.data?.message || "Failed to update ticket archive status. Please try again.",
        );
      },
    });
  };
  
  const task = {
    title: ticket?.subject || ticket?.title || "Untitled Task", 
    status: ticket?.status || "To Do",
    assignee: ticket?.assignedTo?.[0]?.email?.charAt(0).toUpperCase() || "NA",
    dateStart: ticket?.createdAt ? format(new Date(ticket.createdAt), 'MMM d') : "Start",
    dateDue: ticket?.dueDate ? format(new Date(ticket.dueDate), 'MMM d') : "Due",
    priority: ticket?.priority || "Normal"
  };

  const handleSave = () => {
    console.log("Saving new description:", description);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 transition-opacity">
      
      <div className="w-full max-w-[1200px] bg-white h-[90vh] rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ticket Details</span>
          </div>
  
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <Save className="w-4 h-4" /> Save Changes
            </button>
            <button 
              onClick={() => {
                setActionError(null);
                setIsActionModalOpen(true);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isArchived
                  ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  : "text-orange-600 bg-orange-50 hover:bg-orange-100"
              }`}
            >
              <Archive className="w-4 h-4" />
              {isArchived ? "Restore" : "Archive"}
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
            title={isArchived ? "Restore Ticket" : "Archive Ticket"}
            description={
              isArchived
                ? "Restore this ticket back to the inbox?"
                : "Archive this ticket? You can restore it later from Backlog."
            }
            confirmLabel={isArchived ? "Restore" : "Archive"}
            loadingLabel={isArchived ? "Restoring..." : "Archiving..."}
          />
          
          <h1 className="text-4xl font-bold text-gray-900 mb-10 tracking-tight">
            {task.title}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 pb-10 border-b border-gray-100">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                <CircleDot className="w-4 h-4" /> Status
              </div>
              <TicketStatusBadge
                status={task.status}
                className="text-[11px] uppercase px-4 py-1.5"
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
                <div className="text-gray-400 text-sm font-bold uppercase tracking-wider">Description</div>
                <div className="text-[10px] text-blue-500 font-medium uppercase bg-blue-50 px-2 py-0.5 rounded">Editor Mode</div>
             </div>
             
             <textarea 
               value={description}
               onChange={(e) => setDescriptionDraft(e.target.value)}
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
