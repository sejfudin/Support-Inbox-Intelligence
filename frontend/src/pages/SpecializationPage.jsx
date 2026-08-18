import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { ArrowDown, ArrowRight, ArrowUp, MoreHorizontal, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import FilterSelect from '@/components/FilterSelect';
import { useSpecializations, useClearSpecialization } from '@/queries/specializations';
import TableSkeleton from '@/components/Skeletons/TableSkeleton';
import { useMentorCandidates } from '@/queries/users';
import { AssignSpecializationModal } from '@/components/interns/specialization/AssignSpecializationModal';
import { ReassignSpecializationDialog } from '@/components/interns/specialization/ReassignSpecializationDialog';
import { ChangeMentorModal } from '@/components/interns/specialization/ChangeMentorModal';
import { DeleteConfirmModal } from '@/components/Modals/DeleteConfirmModal';
import { getAvatarColor } from '@/helpers/avatarColor';
import { getInitials } from '@/helpers/getInitials';
import { formatDate } from '@/helpers/date';

const STATUS_OPTIONS = [
  { value: 'specialized', label: 'Specialized' },
  { value: 'unspecialized', label: 'Unspecialized' },
  { value: 'all', label: 'All' },
];

/** Hairline between two segments of the stat bar. */
function BarDivider() {
  return <span className="h-4 w-px shrink-0 bg-separator" aria-hidden="true" />;
}

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
      <PageSection className="space-y-4">
        <PageHeading
          crumb="Admin"
          title="Specialization"
          subtitle="Confirm an intern's focus position and pair them with a dedicated mentor."
          actions={
            <>
              <div className="relative w-full md:w-[220px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search interns..."
                  className="pl-[30px] text-[12.5px] md:text-[12.5px]"
                  aria-label="Search by name or email"
                  data-test="specialization-search-input"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9"
                onClick={() => openAssignModal()}
                data-test="assign-specialization-button"
              >
                <Plus className="h-4 w-4" />
                Assign specialization
              </Button>
            </>
          }
        />

        {/* Coverage first, filters second, on one bar. The page's whole job is
            "how many interns still need a specialization" — that number belongs
            above the table, not buried as a caption beside the dropdowns. */}
        <div className="app-card flex flex-wrap items-center gap-x-3.5 gap-y-2 px-[18px] py-3">
          <p
            className="text-[13px] text-muted-foreground"
            data-test="specialization-coverage-label"
          >
            <span className="font-semibold text-foreground">
              {specializedCount} of {totalCount}
            </span>{' '}
            interns specialized
          </p>

          {unspecializedCount > 0 && (
            <>
              <BarDivider />
              {/* Amber text, not a filled button: it is a count that happens to be
                  a shortcut into the unspecialized filter, and a solid button
                  here read as the page's primary action next to the real one. */}
              <button
                type="button"
                onClick={handleGoToUnspecialized}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--tone-warning-fg))] underline-offset-2 transition-colors hover:underline dark:text-[hsl(var(--tone-warning-fg))]"
                data-test="specialization-need-one-chip"
              >
                {unspecializedCount} need one
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}

          {mentorId && (
            <>
              <BarDivider />
              <span
                className="text-[12.5px] text-muted-foreground"
                data-test="specialization-mentor-load"
              >
                {stats?.mentorLoad ?? 0} specialization{stats?.mentorLoad === 1 ? '' : 's'} for this
                mentor
              </span>
            </>
          )}

          <span className="flex-1" />

          <span
            className="text-[12px] text-muted-foreground/75"
            data-test="specialization-result-count"
          >
            {isPending
              ? 'Loading…'
              : `${totalMatching} intern${totalMatching === 1 ? '' : 's'}${
                  isFetching ? ' · updating…' : ''
                }`}
          </span>

          <FilterSelect
            value={status}
            options={STATUS_OPTIONS}
            onChange={handleStatusChange}
            // "Specialized" is the resting state, so only the other two count as
            // a filter the reader put there.
            active={status !== 'specialized'}
            dataTest="specialization-status-filter"
          />
          <FilterSelect
            value={mentorId}
            options={mentors.map((mentor) => ({ value: mentor._id, label: mentor.fullname }))}
            onChange={handleMentorChange}
            allLabel="All mentors"
            dataTest="specialization-mentor-filter"
          />
        </div>

        <div className="app-card overflow-hidden">
          {isError && (
            <p
              className="p-6 text-[12.5px] text-[hsl(var(--tone-danger-fg))]"
              data-test="specializations-error"
            >
              Failed to load specializations.
            </p>
          )}
          {isPending && <TableSkeleton columns={5} rows={8} minWidthClassName="min-w-[900px]" />}
          {!isPending && !isError && (
            <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Intern</TableHead>
                    <TableHead className="w-[210px]">Position</TableHead>
                    <TableHead className="w-[190px]">Mentor</TableHead>
                    <TableHead className="w-[140px]">
                      <button
                        type="button"
                        onClick={handleToggleAssignedSort}
                        className="inline-flex items-center gap-1.5 uppercase tracking-[0.07em] transition-colors hover:text-foreground"
                        data-test="specialization-assigned-sort"
                      >
                        Assigned
                        {assignedSortDirection === 'desc' ? (
                          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specializations.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="h-auto py-12 text-center text-[12.5px] text-muted-foreground"
                      >
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
                    const fullname = specialization.user?.fullname || 'Unknown';

                    return (
                      <TableRow
                        key={specialization._id}
                        className="cursor-pointer"
                        onClick={() => handleRowClick(specialization)}
                        data-test={`specialization-row-${specialization._id}`}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[10.5px] font-bold',
                                getAvatarColor(fullname)
                              )}
                              aria-hidden="true"
                            >
                              {getInitials(fullname)}
                            </span>
                            <div className="min-w-0 leading-[1.35]">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {fullname}
                              </p>
                              <p className="truncate text-[11.5px] text-muted-foreground/75">
                                {specialization.user?.email || '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {specialization.declaredPosition?.name ? (
                            <span
                              className="text-foreground"
                              data-test={`specialization-badge-${specialization._id}`}
                            >
                              {specialization.declaredPosition.name}
                            </span>
                          ) : (
                            // Italic, because it is the absence of a value rather
                            // than one — the row still needs an Assign button, and
                            // a plain dash would not say why it is disabled.
                            <span className="italic text-muted-foreground/75">
                              No position declared yet
                            </span>
                          )}
                          {specialization.secondaryPosition?.name && (
                            <p className="mt-0.5 text-[11.5px] text-muted-foreground/75">
                              2nd: {specialization.secondaryPosition.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {specialization.secondaryMentor?.fullname || (
                            <span className="text-muted-foreground/75">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {isSpecialized ? (
                            formatDate(specialization.specializationAssignedAt)
                          ) : (
                            <span className="text-muted-foreground/75">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end">
                            {isSpecialized ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
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
                                    className="text-[hsl(var(--tone-danger-fg))] focus:text-[hsl(var(--tone-danger-fg))]"
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
                                className="h-7 rounded-[var(--r-control)] px-3 text-[12px]"
                                disabled={!specialization.declaredPosition}
                                title={
                                  specialization.declaredPosition
                                    ? undefined
                                    : 'This intern has to declare a position first.'
                                }
                                onClick={() => openAssignModal(specialization.user?._id)}
                                data-test={`specialization-assign-${specialization._id}`}
                              >
                                Assign
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-separator px-[18px] py-3">
              <p className="text-[12px] text-muted-foreground/75">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
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
                  className="h-8"
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
