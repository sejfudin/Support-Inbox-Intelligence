import React, { createContext, useContext, useCallback, useState } from "react";

const TicketModalContext = createContext(null);

export const TicketModalProvider = ({ children }) => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState("to do");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const openNewTicket = useCallback((status = "to do") => {
    setInitialStatus(status === undefined ? "to do" : status);
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

  return (
    <TicketModalContext.Provider
      value={{
        isNewOpen,
        initialStatus,
        selectedTicketId,
        isDetailsOpen,
        openNewTicket,
        closeNewTicket,
        openTicketDetails,
        closeTicketDetails,
      }}
    >
      {children}
    </TicketModalContext.Provider>
  );
};

export const useTicketModalContext = () => {
  const context = useContext(TicketModalContext);
  if (!context) {
    throw new Error(
      "useTicketModalContext must be used within a TicketModalProvider"
    );
  }
  return context;
};
