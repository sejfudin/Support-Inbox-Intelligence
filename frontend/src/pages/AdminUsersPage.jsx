import React, { useState } from "react";
import { DataTable } from "@/components/Tickets/TicketsTable";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserEditModal from "@/components/UserEditModal";
import { useNavigate } from "react-router-dom";
import { useUsers } from "@/queries/users";
import { columns } from "@/components/columns/userColumns";
import { useDebounce } from "use-debounce";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500); 
  const navigate = useNavigate();
  const { data: usersData, isPending, isError } = useUsers({ page, limit, search: debouncedSearch });
  const [editingUser, setEditingUser] = useState(null);
  const users =
    usersData?.users?.map((user) => ({
      id: user._id,
      fullName: user.fullname || "No name",
      user: user.fullname || "No name",
      email: user.email,
      role: user.role,
      status: user.status || (user.active === true ? "active" : "inactive"),
    })) ?? [];

  const pagination = usersData?.pagination;

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
  };

  
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Failed to load users
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <div className="app-panel flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="app-kicker mb-3">Admin directory</div>
            <h1 className="app-title">All Users</h1>
            <p className="app-subtitle">
            Global user directory across the entire TaskManager app.
            </p>
          </div>
        
          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
            <div className="relative w-full sm:flex-1 md:w-80 md:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); 
                }}
              />
            </div>

            <Button onClick={() => navigate("/register")} className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        </div>

        <div className="app-panel overflow-hidden">
          {isPending ? (
            <TableSkeleton columns={5} rows={6} minWidthClassName="min-w-[800px]" />
          ) : (
            <DataTable
              columns={columns}
              data={users}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              meta={{
                onRowClick: (id, user) => handleEditUser(user),
              }}
            />
          )}
      </div>
      </div>

      {editingUser && (
        <UserEditModal user={editingUser} onClose={handleCloseModal} />
      )}
    </div>
  );
}
