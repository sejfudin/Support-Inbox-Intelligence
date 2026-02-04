import React, { useState } from "react";
import { DataTable } from "@/components/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserEditModal from "@/components/UserEditModal";
import { useNavigate } from "react-router-dom";

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
  const handleRegister = (navigate) => {
    navigate("/register");
  };
  const [activeTab, setActiveTab] = React.useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([
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
      role: "User",
      status: "Active",
    },
    {
      id: "3",
      user: "Sarah Smith",
      email: "sarah@example.com",
      role: "User",
      status: "Inactive",
    },
    {
      id: "4",
      user: "Mike Brown",
      email: "mike@example.com",
      role: "Admin",
      status: "Inactive",
    },
  ]);

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleSaveUser = (updatedUser) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
    setEditingUser(null);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
  };

  const columns = [
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
      cell: ({ row }) => (
        <button
          onClick={() => handleEditUser(row.original)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
        <h1 className="text-xl font-bold sm:text-2xl">User Management</h1>
        <Button onClick={() => handleRegister(navigate)}>Add New User</Button>
      </div>
      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow">
          <DataTable columns={columns} data={users} />
        </div>
      </div>

      {editingUser && (
        <UserEditModal
          user={editingUser}
          onSave={handleSaveUser}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
