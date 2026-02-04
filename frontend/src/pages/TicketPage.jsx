import React, { useState } from "react";
import { DataTable } from "@/components/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTickets } from "@/queries/tickets";
import {columns} from "@/components/columns/ticketColumns";
import { useDebounce } from "use-debounce"; 

export default function TicketPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;
  const [debouncedSearch] = useDebounce(search, 500);

  const { data, isLoading, isError, isPlaceholderData } = useTickets({ 
      page, 
      limit, 
      search: debouncedSearch,
      status: activeTab === "all" ? "" : activeTab 
    });
  const tickets = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
        <h1 className="text-xl font-bold sm:text-2xl">Inbox</h1>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="Search tickets..." className="pl-9" value={search}
            onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); 
            }}/>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white">
        <div className="flex items-center gap-6 overflow-x-auto px-4 sm:px-6 md:px-8">
          {[
            { key: "all", label: "All" },
            { key: "done", label: "Done" },
            { key: "inProgress", label: "In progress" },
            { key: "blocked", label: "Blocked" },
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
        <div className={`bg-white rounded-lg shadow min-h-[400px] ${isPlaceholderData ? "opacity-60" : ""}`}>
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
