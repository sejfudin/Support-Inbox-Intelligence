import React, { useState } from "react";
import { DataTable } from "@/components/TicketsTable";
import { columns } from "@/components/columns/ticketColumns";
import { useTickets } from "@/queries/tickets";
import { TicketDetailsModal } from "@/components/modals/TicketDetailsModal";

export default function TicketPage() {
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data, isLoading } = useTickets({ page: 1, limit: 10 });
  const tickets = data?.data || [];

  const handleOpenTicket = (id) => {
    setSelectedTicketId(id);
    setIsModalOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <div className="p-8">
        <DataTable 
          columns={columns} 
          data={tickets} 
          meta={{ onOpenTicket: handleOpenTicket }} 
        />
      </div>

      <TicketDetailsModal 
        ticketId={selectedTicketId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTicketId(null);
        }}
      />
    </div>
  );
}