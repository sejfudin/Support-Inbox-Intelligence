import React, { useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserEditModal from "@/components/UserEditModal";
import { useNavigate } from "react-router-dom";
import { useUsers } from "@/queries/users";
import { RoleBadge } from "@/components/RoleBadge";
import { UserStatusBadge } from "@/components/UserStatusBadge";
import { columns } from "@/components/columns/userColumns";
import { useDebounce } from "use-debounce";


export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500); 
  const navigate = useNavigate();
  const { data: usersData, isPending, isError } = useUsers({ page, limit, search: debouncedSearch });
  const [editingUser, setEditingUser] = useState(null);
const users =
    usersData?.users?.map((u) => ({ 
      id: u._id,
      user: u.fullname || "No name",
      email: u.email,
      role: u.role,
      status: u.active === true ? "Active" : "Inactive",
    })) ?? [];

    const pagination = usersData?.pagination;

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
  };

  
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-muted-foreground">Loading users...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Failed to load users
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
     <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
        <h1 className="text-xl font-bold sm:text-2xl text-foreground">User Management</h1>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // Resetuj na prvu stranu pri kucanju
              }}
            />
          </div>

          <Button onClick={() => navigate("/register")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow">
      <DataTable
            columns={columns}
            data={users} 
            pagination={pagination}
          onPageChange={(newPage) => setPage(newPage)}
            meta={{
              onEditUser: handleEditUser 
            }}
          />       
      </div>
      </div>

      {/* Edit modal */}
      {editingUser && (
        <UserEditModal user={editingUser} onClose={handleCloseModal} />
      )}
    </div>
  );
}
