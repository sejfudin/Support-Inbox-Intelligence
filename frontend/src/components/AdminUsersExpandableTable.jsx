import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Pencil, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RoleBadge } from '@/components/RoleBadge';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminUsersExpandableTable({
  data,
  pagination,
  onPageChange,
  onEditUser,
  onRowClick,
  isLoading,
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (userId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleNext = () => {
    if (pagination && pagination.page < pagination.pages) {
      onPageChange(pagination.page + 1);
    }
  };

  const handlePrevious = () => {
    if (pagination && pagination.page > 1) {
      onPageChange(pagination.page - 1);
    }
  };

  const currentPage = pagination?.page || 1;
  const totalResults = pagination?.total || 0;
  const limit = pagination?.limit || 10;
  const from = totalResults === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalResults);

  return (
    <div className="w-full space-y-4">
      <div className="w-full overflow-x-auto rounded-lg border border-border/70">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead className="w-[5%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {/* Expand icon column */}
              </TableHead>
              <TableHead className="w-[35%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                User
              </TableHead>
              <TableHead className="w-[15%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Global Role
              </TableHead>
              <TableHead className="w-[20%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Memberships
              </TableHead>
              <TableHead className="w-[15%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-[10%] h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data?.length ? (
              data.map((user) => (
                <React.Fragment key={user.id}>
                  {/* Parent Row */}
                  <TableRow
                    className="border-b border-border/70 transition-colors hover:bg-secondary/50 cursor-pointer"
                    onClick={() => onRowClick?.(user.id)}
                  >
                    <TableCell className="w-[5%] py-4 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(user.id);
                        }}
                        className="inline-flex items-center justify-center rounded p-1 hover:bg-secondary"
                      >
                        {expandedRows.has(user.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>

                    {/* User Info */}
                    <TableCell className="w-[35%] py-4 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs font-semibold">
                            {getInitials(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {user.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Global Role */}
                    <TableCell className="w-[15%] py-4 px-4">
                      <RoleBadge role={user.role} />
                    </TableCell>

                    {/* Membership Summary */}
                    <TableCell className="w-[20%] py-4 px-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-sm">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {user.workspaceCount === 1
                            ? 'In 1 Workspace'
                            : `In ${user.workspaceCount} Workspaces`}
                        </span>
                      </div>
                    </TableCell>

                    {/* Account Status */}
                    <TableCell className="w-[15%] py-4 px-4">
                      <UserStatusBadge status={user.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="w-[10%] py-4 px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditUser?.(user);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Content - Workspaces Sub-table */}
                  {expandedRows.has(user.id) && (
                    <TableRow className="border-b border-border/70 bg-muted/30">
                      <TableCell colSpan={6} className="py-0">
                        <div className="px-4 py-4">
                          <div className="mb-3 text-sm font-semibold text-foreground">
                            Workspace Memberships
                          </div>
                          <div className="overflow-x-auto rounded-lg border border-border/50 bg-background">
                            <Table className="min-w-full text-sm">
                              <TableHeader>
                                <TableRow className="bg-secondary/30">
                                  <TableHead className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                    Workspace Name
                                  </TableHead>
                                  <TableHead className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                    Role
                                  </TableHead>
                                  <TableHead className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                    Status
                                  </TableHead>
                                  <TableHead className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                                    Date Joined
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {user.workspaces && user.workspaces.length > 0 ? (
                                  user.workspaces.map((workspace, idx) => (
                                    <TableRow key={idx} className="border-t border-border/30">
                                      <TableCell className="px-4 py-2.5">
                                        {workspace.name}
                                      </TableCell>
                                      <TableCell className="px-4 py-2.5">
                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                          {workspace.role || 'member'}
                                        </span>
                                      </TableCell>
                                      <TableCell className="px-4 py-2.5">
                                        <span
                                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                            workspace.status === 'active'
                                              ? 'bg-green/10 text-green-700'
                                              : 'bg-yellow/10 text-yellow-700'
                                          }`}
                                        >
                                          {workspace.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                                        {formatDate(workspace.joinedAt || workspace.createdAt)}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                                      No workspace memberships
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{from}</span> to{' '}
          <span className="font-medium">{to}</span> of{' '}
          <span className="font-medium">{pagination?.total || 0}</span> results
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrevious}
            disabled={!pagination || pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            disabled={!pagination || pagination.page >= pagination.pages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
