import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
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
      user: user.fullname || 'No name',
      email: user.email,
      role: user.role,
      hub: user.hub?._id || user.hub || '',
      hubName: user.hub?.name || '',
      active: user.status === 'active',
      // Passed through rather than folded to active/inactive: the enum is
      // active | invited | disabled, and an invited user who has never signed in
      // is not the same row as one an admin switched off. `UserStatusBadge` owns
      // the labels ("Deactivated" for `disabled`).
      status: user.status,
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
      <div className="flex items-center justify-center min-h-screen text-[hsl(var(--tone-danger))]">
        Failed to load users
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content space-y-6">
        <PageHeading
          crumb="Admin"
          title="All users"
          subtitle="Global user directory across the entire platform."
          actions={
            <>
              <SearchField
                id="admin-users-search"
                value={search}
                onChange={(next) => {
                  setSearch(next);
                  setPage(1);
                }}
                placeholder="Search users…"
                aria-label="Search users"
                width="header"
                className="w-full sm:flex-1 md:w-[320px] md:flex-none"
                data-test="admin-users-search-input"
              />

              <Button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto"
                data-test="admin-users-create-button"
              >
                <UserPlus className="h-4 w-4" />
                Create user
              </Button>
            </>
          }
        />

        <div className="app-card overflow-hidden">
          {isPending ? (
            <TableSkeleton columns={5} rows={10} minWidthClassName="min-w-[760px]" />
          ) : (
            <AdminUsersExpandableTable
              data={users}
              pagination={pagination}
              onPageChange={(newPage) => setPage(newPage)}
              onEditUser={handleEditUser}
              onRowClick={handleOpenUserAnalytics}
            />
          )}
        </div>
      </div>

      {editingUser && <UserEditModal user={editingUser} onClose={handleCloseModal} />}
    </div>
  );
}
