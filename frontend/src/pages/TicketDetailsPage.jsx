import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns'; 
import { 
  Calendar, 
  Flag, 
  User, 
  Check,
  Play,
  CircleDot,
  ArrowLeft
} from 'lucide-react';

import { useTicket } from '@/queries/tickets';

export const TicketDetailsPage = () => {
  const navigate = useNavigate();
  const { ticketId } = useParams(); 

  const { data: apiResponse, isLoading, isError } = useTicket(ticketId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-slate-500 font-medium">
        Loading task details...
      </div>
    );
  }

  if (isError || !apiResponse) {
    return (
      <div className="flex h-screen items-center justify-center bg-white flex-col gap-4">
        <div className="text-red-500 font-medium">Error loading task.</div>
        <button 
            onClick={() => navigate('/tickets')}
            className="text-sm text-gray-500 hover:text-gray-900 underline"
        >
            Back to Inbox
        </button>
      </div>
    );
  }

  const ticket = apiResponse.data || apiResponse;
  
  console.log("Ticket Data:", ticket); 

  const task = {
    id: ticketId,
    title: ticket.subject || ticket.title || "Untitled Task", 
    description: ticket.description || "No description provided.",
    status: ticket.status || "OPEN",
    
    assignee: ticket.assignedTo && ticket.assignedTo.length > 0 
      ? (ticket.assignedTo[0].email || ticket.assignedTo[0].name || "?").charAt(0).toUpperCase() 
      : "NA",
    
    assigneeColor: ticket.assignedTo && ticket.assignedTo.length > 0 ? "#4186E0" : "#cbd5e1",

    dateStart: ticket.createdAt ? format(new Date(ticket.createdAt), 'MMM d') : "Start",
    dateDue: ticket.dueDate ? format(new Date(ticket.dueDate), 'MMM d') : "Due",
    
    priority: ticket.priority || "Normal"
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
        case 'closed': return '#22c55e'; 
        case 'done': return '#22c55e';   
        case 'pending': return '#eab308';
        case 'in progress': return '#3b82f6'; 
        default: return '#9E54B0';
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 font-sans overflow-y-auto">
      
      <div className="px-10 pt-6">
        <button 
            onClick={() => navigate('/tickets')}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
        >
            <ArrowLeft className="w-4 h-4" /> Back to List
        </button>
      </div>

      <div className="px-10 pt-4 max-w-6xl w-full pb-20">
      
        <h1 className="text-4xl font-bold text-gray-900 mb-8 tracking-tight">
          {task.title}
        </h1>

        <div className="grid grid-cols-[160px_1fr_160px_1fr] gap-y-7 gap-x-4 mb-12 items-center">
          
          <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
            <div className="w-4 flex justify-center text-gray-400">
                <CircleDot className="w-4 h-4" />
            </div>
            Status
          </div>
          
          <div className="flex items-center gap-2">
            <div 
                className="flex items-center text-white rounded-sm text-[11px] font-bold uppercase overflow-hidden shadow-sm group cursor-pointer transition-colors"
                style={{ backgroundColor: getStatusColor(task.status) }}
            >
                <span className="px-3 py-1.5 tracking-wide">{task.status}</span>
                <span className="brightness-90 px-1.5 py-1.5 border-l border-[#ffffff30] flex items-center justify-center hover:brightness-75 bg-black/10">
                    <Play className="w-[8px] h-[8px] fill-current" />
                </span>
            </div>
            <div className="w-7 h-7 rounded-sm bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-300 flex items-center justify-center text-gray-400 transition-all cursor-pointer">
                <Check className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
            <div className="w-4 flex justify-center text-gray-400">
                <User className="w-4 h-4" />
            </div>
            Assignees
          </div>

          <div className="flex items-center">
             <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white shadow-sm cursor-pointer hover:opacity-90"
                style={{ backgroundColor: task.assigneeColor }}
             >
                {task.assignee}
             </div>
          </div>

          <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
             <div className="w-4 flex justify-center text-gray-400">
                <Calendar className="w-4 h-4" /> 
             </div>
             Dates
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="hover:bg-gray-100 hover:text-gray-700 px-2 py-1 -ml-2 rounded cursor-pointer flex items-center gap-2 transition-colors">
                <Calendar className="w-3.5 h-3.5" /> 
                <span>{task.dateStart}</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="hover:bg-gray-100 hover:text-gray-700 px-2 py-1 rounded cursor-pointer flex items-center gap-2 transition-colors">
                <Calendar className="w-3.5 h-3.5" /> 
                <span>{task.dateDue}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-gray-500 text-sm font-medium">
            <div className="w-4 flex justify-center text-gray-400">
                <Flag className="w-4 h-4" /> 
            </div>
            Priority
          </div>

          <div className="text-gray-400 text-sm hover:bg-gray-100 hover:text-gray-700 px-2 py-1 -ml-2 rounded cursor-pointer w-fit transition-colors capitalize">
            {task.priority}
          </div>

        </div>

        <div className="border border-gray-200 rounded-lg p-8 min-h-[300px] text-gray-800 text-base shadow-sm bg-white hover:border-gray-300 transition-colors whitespace-pre-wrap">
          {task.description}
        </div>

      </div>
    </div>
  );
};