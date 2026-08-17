import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const users =
    usersData?.users?.map((user) => ({
      id: user._id,
      fullName: user.fullname || 'No name',
      user: user.fullname || 'No name',
      email: user.email,
      role: user.role,
      hub: user.hub?._id || user.hub || '',
      hubName: user.hub?.name || '',
      active: user.status === 'active',
      status: user.status === 'active' ? 'active' : 'inactive',
      workspaceCount: user.workspaceCount || 0,
      workspaces: user.workspaces || [],
    })) ?? [];

  const pagination = usersData?.pagination;

  // Editing a user lives on their profile, not in the directory: a row click opens
  // `/user/:userId`, whose header carries the Edit button and owns `UserEditModal`
  // (`AdminUserAnalyticsPage` → `AdminStaffUserDetail`). This page used to hold a
  // second copy of that state, wired to an `onEditUser` prop the table no longer
  // accepts — so the modal it rendered was unreachable.
  const handleOpenUserAnalytics = (id) => {
    navigate(`/user/${id}`);
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
          crumb="Admin directory"
          title="All Users"
          subtitle="Global user directory across the entire TaskManager app."
          actions={
            <>
              <div className="relative w-full sm:flex-1 md:w-80 md:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-users-search"
                  type="text"
                  placeholder="Search users..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  data-test="admin-users-search-input"
                />
              </div>

              <Button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto"
                data-test="admin-users-create-button"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </>
          }
        />

        <div className="app-panel overflow-hidden">
          {isPending ? (
            // Four columns at the table's own 760px floor — a six-column skeleton
            // over a wider table shifts the layout the moment the real rows land.
            <TableSkeleton columns={4} rows={6} minWidthClassName="min-w-[760px]" />
          ) : (
            <AdminUsersExpandableTable
              data={users}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              onRowClick={handleOpenUserAnalytics}
            />
          )}
        </div>
      </div>
    </div>
  );
}
