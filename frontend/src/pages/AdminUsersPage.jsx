import React from "react";
import { DataTable } from "@/components/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const users = [
  {
    id: "1",
    user: "Evil Hacker",
    email: "hacker@example.com",
    role: "Admin",
    status: "Active",
  },
  {
    id: "2",
    user: "John Doe",
    email: "john@example.com",
    role: "Agent",
    status: "Active",
  },
  {
    id: "3",
    user: "Sarah Smith",
    email: "sarah@example.com",
    role: "Agent",
    status: "Inactive",
  },
  {
    id: "4",
    user: "Mike Brown",
    email: "mike@example.com",
    role: "Admin",
    status: "Inactive",
  },
];

const getStatusBadge = (status) => {
  const s = status.toLowerCase();
  const style =
    s === "active"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <Badge
      variant="outline"
      className={`${style} px-3 py-1 text-xs font-bold uppercase tracking-wider`}
    >
      {status}
    </Badge>
  );
};

const getRoleBadge = (role) => {
  const r = role.toLowerCase();
  let style = "bg-slate-100 text-slate-700 border-slate-200"; // Default
  if (r === "admin") style = "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (r === "agent") style = "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <Badge
      variant="outline"
      className={`${style} px-3 py-1 text-xs font-bold uppercase tracking-wider`}
    >
      {role}
    </Badge>
  );
};

export const columns = [
  {
    accessorKey: "user",
    header: "USER",
    cell: ({ row }) => (
      <div className="flex justify-center flex-col">
        <span className="font-semibold text-foreground">
          {row.original.user}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.original.email}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "ROLE",
    cell: ({ row }) => getRoleBadge(row.original.role),
  },
  {
    accessorKey: "status",
    header: "STATUS",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    accessorKey: "action",
    header: "ACTION",
    cell: () => (
      <button className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
        Edit
      </button>
    ),
  },
];

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = React.useState("all");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
        <h1 className="text-xl font-bold sm:text-2xl">User Management</h1>
      </div>
      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow">
          <DataTable columns={columns} data={users} />
        </div>
      </div>
    </div>
  );
}
