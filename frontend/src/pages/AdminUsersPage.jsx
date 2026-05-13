import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserEditModal from '@/components/UserEditModal';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '@/queries/users';
import { useDebounce } from 'use-debounce';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import AdminUsersExpandableTable from '@/components/AdminUsersExpandableTable';
import PageHeading from '@/components/PageHeading';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);
  const navigate = useNavigate();
  const {
    data: usersData,
    isPending,
    isError,
  } = useUsers({ page, limit, search: debouncedSearch });
  const [editingUser, setEditingUser] = useState(null);
  const users =
    usersData?.users?.map((user) => ({
      id: user._id,
      fullName: user.fullname || 'No name',
      email: user.email,
      role: user.role,
      status: user.status === 'active' ? 'active' : 'inactive',
      workspaceCount: user.workspaceCount || 0,
      workspaces: user.workspaces || [],
    })) ?? [];

  const pagination = usersData?.pagination;

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleOpenUserAnalytics = (id) => {
    navigate(`/user/${id}`);
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
        <PageHeading
          kicker="Admin directory"
          title="All Users"
          subtitle="Global user directory across the entire TaskManager app."
          actions={
            <>
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

              <Button onClick={() => navigate('/register')} className="w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </>
          }
        />

        <div className="app-panel overflow-hidden">
          {isPending ? (
            <TableSkeleton columns={6} rows={6} minWidthClassName="min-w-[1000px]" />
          ) : (
            <AdminUsersExpandableTable
              data={users}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              onEditUser={handleEditUser}
              onRowClick={handleOpenUserAnalytics}
              isLoading={isPending}
            />
          )}
        </div>
      </div>

      {editingUser && <UserEditModal user={editingUser} onClose={handleCloseModal} />}
    </div>
  );
}
