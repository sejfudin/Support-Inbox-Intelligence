import React, { useState } from "react";
import { DataTable } from "@/components/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search, LayoutList, LayoutGrid, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTickets } from "@/queries/tickets";
import { columns } from "@/components/columns/ticketColumns";
import { useDebounce } from "use-debounce";
import BoardPage from "@/components/BoardPage";
import NewTickets from "@/components/NewTickets";
import TicketDetailsModal from "@/components/Modals/TicketDetailsModal";

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const limit = 10;
  const [debouncedSearch] = useDebounce(search, 500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const isBoard = viewMode === "board";

  // List = paginated
  const listQuery = useTickets(
    {
      page,
      limit: 10,
      search: debouncedSearch,
      status: activeTab === "all" ? "" : activeTab,
    },
    { enabled: !isBoard },
  );

  // Board = all
  const boardQuery = useTickets(
    {
      page: 1,
      limit: 10000, // all tickets
      search: debouncedSearch,
      status: activeTab === "all" ? "" : activeTab,
    },
    { enabled: isBoard },
  );

  const handleOpenTicket = (id) => {
    setSelectedTicketId(id);
    setIsDetailsOpen(true);
  };

  const activeQuery = isBoard ? boardQuery : listQuery;

  const tickets = activeQuery.data?.data || [];
  const pagination = isBoard ? null : activeQuery.data?.pagination;

  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;
  const isPlaceholderData = activeQuery.isPlaceholderData;

  const handleNewTicket = () => {
    setIsModalOpen(true);
  };
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {isModalOpen && <NewTickets onClose={() => setIsModalOpen(false)} />}
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
        <h1 className="text-xl font-bold sm:text-2xl">Inbox</h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1 shrink-0">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "board" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("board")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Board</span>
            </Button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tickets..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button onClick={handleNewTicket}>
            <Plus className="h-4 w-4 mr-2" />
            New task
          </Button>
        </div>
      </div>

      {/* Conditional Content Based on View Mode */}
      {viewMode === "board" ? (
        <BoardPage tickets={tickets} isLoading={isLoading} isError={isError} />
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b bg-white">
            <div className="flex items-center gap-6 overflow-x-auto px-4 sm:px-6 md:px-8">
              {[
                { key: "all", label: "All" },
                { key: "to do", label: "To do" },
                { key: "in progress", label: "In progress" },
                { key: "on staging", label: "On staging" },
                { key: "blocked", label: "Blocked" },
                { key: "done", label: "Done" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  className={`flex flex-shrink-0 items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 md:p-8">
            <div
              className={`bg-white rounded-lg shadow min-h-[400px] ${isPlaceholderData ? "opacity-60" : ""}`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-64 font-medium text-gray-500">
                  Loading tickets...
                </div>
              ) : isError ? (
                <div className="flex items-center justify-center h-64 text-red-500">
                  Something went wrong.
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={tickets}
                  pagination={pagination}
                  onPageChange={(newPage) => setPage(newPage)}
                  meta={{ onOpenTicket: handleOpenTicket }}
                />
              )}
              <TicketDetailsModal
                ticketId={selectedTicketId}
                isOpen={isDetailsOpen}
                onClose={() => {
                  setIsDetailsOpen(false);
                  setSelectedTicketId(null);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
