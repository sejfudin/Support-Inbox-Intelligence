import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { ArrowDown, ArrowRight, ArrowUp, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageHeading from '@/components/PageHeading';
import { PageShell, PageSection } from '@/components/PageShell';
import { useSpecializations, useClearSpecialization } from '@/queries/specializations';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { useMentorCandidates } from '@/queries/users';
import { AssignSpecializationModal } from '@/components/interns/specialization/AssignSpecializationModal';
import { ReassignSpecializationDialog } from '@/components/interns/specialization/ReassignSpecializationDialog';
import { ChangeMentorModal } from '@/components/interns/specialization/ChangeMentorModal';
import { DeleteConfirmModal } from '@/components/Modals/DeleteConfirmModal';
import { formatDate } from '@/helpers/date';

const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';
const tableCellClass = 'px-4 py-4';

const STATUS_OPTIONS = [
  { value: 'specialized', label: 'Specialized' },
  { value: 'unspecialized', label: 'Unspecialized' },
  { value: 'all', label: 'All' },
];

export default function SpecializationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('specialized');
  const [mentorId, setMentorId] = useState('');
  const [search, setSearch] = useState('');
  const [assignedSortDirection, setAssignedSortDirection] = useState('desc');
  const [debouncedSearch] = useDebounce(search, 400);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignInternUserId, setAssignInternUserId] = useState('');
  const [reassignTarget, setReassignTarget] = useState(null);
  const [changeMentorTarget, setChangeMentorTarget] = useState(null);
  const [clearTarget, setClearTarget] = useState(null);

  const { data: mentorsData } = useMentorCandidates({ hubScoped: false });
  const mentors = mentorsData?.users ?? [];

  const { data, isPending, isFetching, isError } = useSpecializations({
    status,
    mentorId: mentorId || undefined,
    search: debouncedSearch || undefined,
    sort: `assignedAt:${assignedSortDirection}`,
    page,
    limit: 20,
  });

  const clearMutation = useClearSpecialization();

  const specializations = data?.specializations ?? [];
  const pagination = data?.pagination;
  const totalMatching = pagination?.total ?? 0;
  const stats = data?.stats;
  const specializedCount = stats?.specializedCount ?? 0;
  const totalCount = stats?.totalCount ?? 0;
  const unspecializedCount = totalCount - specializedCount;

  const openAssignModal = (internUserId = '') => {
    setAssignInternUserId(internUserId);
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignInternUserId('');
    setAssignModalOpen(false);
  };

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const handleGoToUnspecialized = () => {
    handleStatusChange('unspecialized');
  };

  const handleMentorChange = (nextMentorId) => {
    setMentorId(nextMentorId === 'all' ? '' : nextMentorId);
    setPage(1);
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleToggleAssignedSort = () => {
    setAssignedSortDirection((currentDirection) => (currentDirection === 'desc' ? 'asc' : 'desc'));
    setPage(1);
  };

  const handleRowClick = (specialization) => {
    if (specialization.user?._id) {
      navigate(`/user/${specialization.user._id}`);
    }
  };

  const handleConfirmClear = async () => {
    await clearMutation.mutateAsync(clearTarget.user?._id);
    setClearTarget(null);
  };

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Programme management"
          title="Specialization"
          subtitle="Confirm an intern's focus position and pair them with a dedicated mentor."
          actions={
            <Button
              type="button"
              onClick={() => openAssignModal()}
              data-test="assign-specialization-button"
            >
              <Plus className="h-4 w-4" />
              Assign specialization
            </Button>
          }
          meta={
            <div className="flex flex-wrap items-center gap-3">
              <p
                className="text-sm text-muted-foreground"
                data-test="specialization-coverage-label"
              >
                {specializedCount} of {totalCount} interns specialized
              </p>
              {unspecializedCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGoToUnspecialized}
                  data-test="specialization-need-one-chip"
                >
                  {unspecializedCount} need one
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          }
        />

        <div className="app-panel overflow-hidden pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-5 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]" data-test="specialization-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={mentorId || 'all'} onValueChange={handleMentorChange}>
                <SelectTrigger className="w-[180px]" data-test="specialization-mentor-filter">
                  <SelectValue placeholder="All mentors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All mentors</SelectItem>
                  {mentors.map((mentor) => (
                    <SelectItem key={mentor._id} value={mentor._id}>
                      {mentor.fullname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {mentorId && (
                <span
                  className="text-sm text-muted-foreground"
                  data-test="specialization-mentor-load"
                >
                  {stats?.mentorLoad ?? 0} specialization{stats?.mentorLoad === 1 ? '' : 's'}
                </span>
              )}

              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by name or email"
                className="w-[220px]"
                data-test="specialization-search-input"
              />
            </div>

            <p className="text-sm text-muted-foreground" data-test="specialization-result-count">
              {isPending
                ? 'Loading...'
                : `${totalMatching} intern${totalMatching === 1 ? '' : 's'}${
                    isFetching ? ' · updating...' : ''
                  }`}
            </p>
          </div>

          {isError && (
            <p className="p-6 text-sm text-destructive" data-test="specializations-error">
              Failed to load specializations.
            </p>
          )}
          {isPending && <TableSkeleton columns={5} minWidthClassName="min-w-[1040px]" />}
          {!isPending && !isError && (
            <div className={cn('overflow-x-auto transition-opacity', isFetching && 'opacity-60')}>
              <Table className="min-w-[1040px]">
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className={tableHeadClass}>Intern</TableHead>
                    <TableHead className={tableHeadClass}>Position</TableHead>
                    <TableHead className={tableHeadClass}>Mentor</TableHead>
                    <TableHead className={tableHeadClass}>
                      <button
                        type="button"
                        onClick={handleToggleAssignedSort}
                        className="flex items-center gap-1 uppercase tracking-[0.12em] hover:text-foreground"
                        data-test="specialization-assigned-sort"
                      >
                        Assigned
                        {assignedSortDirection === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className={tableHeadClass}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specializations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        {status === 'unspecialized'
                          ? totalCount === 0
                            ? 'No interns yet.'
                            : 'No unspecialized interns left — everyone has a specialization.'
                          : 'No specializations assigned yet.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {specializations.map((specialization) => {
                    const isSpecialized = Boolean(specialization.specializationAssignedAt);
                    const hasSecondary = Boolean(specialization.secondaryPosition);
                    return (
                      <TableRow
                        key={specialization._id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => handleRowClick(specialization)}
                        data-test={`specialization-row-${specialization._id}`}
                      >
                        <TableCell className={tableCellClass}>
                          <p className="font-semibold text-foreground">
                            {specialization.user?.fullname || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {specialization.user?.email || '-'}
                          </p>
                        </TableCell>
                        <TableCell className={tableCellClass}>
                          {specialization.declaredPosition?.name ? (
                            <Badge
                              variant={isSpecialized ? 'default' : 'outline'}
                              data-test={`specialization-badge-${specialization._id}`}
                            >
                              {specialization.declaredPosition.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">no position declared yet</span>
                          )}
                          {specialization.secondaryPosition?.name && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              2nd: {specialization.secondaryPosition.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className={tableCellClass}>
                          {specialization.secondaryMentor?.fullname || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`${tableCellClass} whitespace-nowrap text-muted-foreground`}
                        >
                          {isSpecialized ? (
                            formatDate(specialization.specializationAssignedAt)
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={tableCellClass}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {isSpecialized ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  data-test={`specialization-row-menu-${specialization._id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={!hasSecondary}
                                  onClick={() => setReassignTarget(specialization)}
                                  data-test={`specialization-reassign-${specialization._id}`}
                                >
                                  Reassign position
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setChangeMentorTarget(specialization)}
                                  data-test={`specialization-change-mentor-${specialization._id}`}
                                >
                                  Change mentor
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setClearTarget(specialization)}
                                  data-test={`specialization-clear-${specialization._id}`}
                                >
                                  Clear specialization
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!specialization.declaredPosition}
                              onClick={() => openAssignModal(specialization.user?._id)}
                              data-test={`specialization-assign-${specialization._id}`}
                            >
                              Assign
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  data-test="specializations-prev-page-button"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  data-test="specializations-next-page-button"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageSection>

      <AssignSpecializationModal
        open={assignModalOpen}
        onClose={closeAssignModal}
        initialInternUserId={assignInternUserId}
      />

      <ReassignSpecializationDialog
        specialization={reassignTarget}
        onClose={() => setReassignTarget(null)}
      />

      <ChangeMentorModal
        specialization={changeMentorTarget}
        onClose={() => setChangeMentorTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={Boolean(clearTarget)}
        onClose={() => setClearTarget(null)}
        onConfirm={handleConfirmClear}
        isLoading={clearMutation.isPending}
        errorMessage={
          clearMutation.isError
            ? clearMutation.error?.response?.data?.message || 'Failed to clear specialization.'
            : ''
        }
        title="Clear specialization"
        description={`Remove ${
          clearTarget?.user?.fullname || 'this intern'
        }'s specialization mentor pairing? Their position stays where it is — you'll need to reassign to undo this.`}
        confirmLabel="Clear specialization"
        loadingLabel="Clearing..."
      />
    </PageShell>
  );
}
