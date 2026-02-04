import React, { useState } from "react";
import { useDebounce } from "use-debounce";
import { LayoutList, LayoutGrid, Plus, Search } from "lucide-react";

import { DataTable } from "@/components/TicketsTable";
import { columns } from "@/components/columns/ticketColumns";
import { useTickets } from "@/queries/tickets";
import { TicketDetailsModal } from "@/components/modals/TicketDetailsModal";
import BoardPage from "@/components/BoardPage";
import NewTickets from "@/components/NewTickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TicketPage() {
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  const { data, isLoading } = useTickets({ 
    page: 1, 
    limit: 10, 
    search: debouncedSearch 
  });
  
  const tickets = data?.data || [];

  const handleOpenTicket = (id) => {
    setSelectedTicketId(id);
    setIsDetailsOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex flex-col gap-4 border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search tickets..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center border rounded-md bg-white p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-sm transition-all ${
                viewMode === "list" ? "bg-gray-100 text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`p-2 rounded-sm transition-all ${
                viewMode === "board" ? "bg-gray-100 text-black shadow-sm" : "text-gray-500 hover:text-black"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        {viewMode === "list" ? (
          <DataTable 
            columns={columns} 
            data={tickets} 
            meta={{ onOpenTicket: handleOpenTicket }} 
          />
        ) : (
          <BoardPage />
        )}
      </div>

      <TicketDetailsModal 
        ticketId={selectedTicketId}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTicketId(null);
        }}
      />

      {isNewTicketOpen && (
        <NewTickets onClose={() => setIsNewTicketOpen(false)} />
      )}
    </div>
  );
}