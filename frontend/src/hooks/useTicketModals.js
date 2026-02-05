import { useCallback, useState } from "react";

export const useTicketModals = () => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState("to do");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const openNewTicket = useCallback((status = "to do") => {
    setInitialStatus(status);
    setIsNewOpen(true);
  }, []);

  const closeNewTicket = useCallback(() => {
    setIsNewOpen(false);
  }, []);

  const openTicketDetails = useCallback((id) => {
    setSelectedTicketId(id);
    setIsDetailsOpen(true);
  }, []);

  const closeTicketDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setSelectedTicketId(null);
  }, []);

  return {
    isNewOpen,
    initialStatus,
    selectedTicketId,
    isDetailsOpen,
    openNewTicket,
    closeNewTicket,
    openTicketDetails,
    closeTicketDetails,
  };
};
