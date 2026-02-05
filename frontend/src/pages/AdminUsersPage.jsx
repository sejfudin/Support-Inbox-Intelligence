import React, { useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useUsers } from "@/queries/users";
import UserEditModal from "@/components/UserEditModal";

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
  let style = "bg-slate-100 text-slate-700 border-slate-200"; // default
  if (r === "admin") style = "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (r === "user") style = "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <Badge
      variant="outline"
      className={`${style} px-3 py-1 text-xs font-bold uppercase tracking-wider`}
    >
      {role}
    </Badge>
  );
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { data: usersData, isLoading, isError } = useUsers();
  const [editingUser, setEditingUser] = useState(null);

  const users =
    usersData?.map((u) => ({
      id: u._id,
      user: u.fullname || "No name",
      email: u.email,
      role: u.role,
      status: u.active ? "Active" : "Inactive",
    })) ?? [];

  const handleEditUser = (user) => setEditingUser(user);
  const handleCloseModal = () => setEditingUser(null);

  const columns = [
    {
      accessorKey: "user",
      header: "USER",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.original.user}</span>
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
      cell: ({ row }) => (
        <button
          onClick={() => handleEditUser(row.original)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
      ),
    },
  ];

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading users...
      </div>
    );

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Failed to load users
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">User Management</h1>
        <Button onClick={() => navigate("/register")}>Add New User</Button>
      </div>

      {/* Table */}
      <div className="flex-1 p-4">
        <div className="bg-white rounded-lg shadow">
          <DataTable columns={columns} data={users} />
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <UserEditModal user={editingUser} onClose={handleCloseModal} />
      )}
    </div>
  );
}
