import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
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
import { capitalizeFirst } from '@/helpers/capitalizeFirst';
import { getInitials } from '@/helpers/getInitials';
import { getAvatarColor } from '@/helpers/avatarColor';
import { badgeTone, CHIP } from '@/helpers/badgeTones';
import { cn } from '@/lib/utils';

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function membershipLabel(count) {
  if (!count) return 'No workspace';
  return count === 1 ? 'In 1 workspace' : `In ${count} workspaces`;
}

export default function AdminUsersExpandableTable({ data, pagination, onPageChange, onRowClick }) {
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
    <div className="w-full">
      {/* 760px is the mockup's floor for these columns — below it the name column
          would be squeezed past the point where an email still fits, so the card
          scrolls sideways instead. */}
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">User</TableHead>
            <TableHead className="w-[130px]">Role</TableHead>
            <TableHead className="w-[150px]">Memberships</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data?.length ? (
            data.map((user) => (
              <React.Fragment key={user.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => onRowClick?.(user.id)}
                  data-test={`admin-users-row-${user.id}-card`}
                >
                  <TableCell className="min-w-[200px]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Tinted from the name, not a flat grey: in a directory of
                          54 people the colour is what lets you re-find a row you
                          scrolled past. `getAvatarColor` is deterministic, so the
                          same person keeps the same tint across the app. */}
                      <span
                        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${getAvatarColor(
                          user.fullName
                        )}`}
                        aria-hidden="true"
                      >
                        {getInitials(user.fullName)}
                      </span>
                      <div className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {user.fullName}
                          </span>
                          {user.isTestAccount && (
                            <span
                              className={cn(CHIP, 'shrink-0 border-0', badgeTone('warning'))}
                              title="Internal QA account — excluded from mentor/leadership pickers and every other user-facing listing"
                            >
                              Test account
                            </span>
                          )}
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground/75">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="w-[130px]">
                    <RoleBadge role={user.role} />
                  </TableCell>

                  {/* Plain text, not a pill: the count is a fact about the row, and
                      a third chip beside the role and status ones turns the line
                      into a row of badges with no hierarchy. */}
                  <TableCell className="w-[150px] text-muted-foreground">
                    {membershipLabel(user.workspaceCount)}
                  </TableCell>

                  <TableCell className="w-[110px]">
                    <UserStatusBadge status={user.status} />
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-separator px-[18px] py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[12px] text-muted-foreground/75">
          Showing <span className="font-medium">{from}</span> to{' '}
          <span className="font-medium">{to}</span> of{' '}
          <span className="font-medium">{totalResults}</span> users
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-[var(--r-control)]"
            aria-label="Previous page"
            onClick={handlePrevious}
            disabled={!pagination || pagination.page <= 1}
            data-test="admin-users-pagination-prev-button"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-[var(--r-control)]"
            aria-label="Next page"
            onClick={handleNext}
            disabled={!pagination || pagination.page >= pagination.pages}
            data-test="admin-users-pagination-next-button"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
