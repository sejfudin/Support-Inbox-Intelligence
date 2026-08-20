import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import TableRowsSkeleton from '@/components/Skeletons/TableRowsSkeleton';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { IN_PIPELINE_STAGE, INTERN_STATUSES, READY_STATUS } from '@/helpers/internProfile';
import { useInterns } from '@/queries/interns';
import { useHubs } from '@/queries/hubs';
import { useInternshipTypes } from '@/queries/internshipTypes';
import { Loader, useLoaderHold } from '@/components/ui/loader';

// Placement-stage filter options in funnel order; `in selection` sits between
// ready and placed because those interns are ready interns with an active
// recommendation.
const stageOptions = INTERN_STATUSES.flatMap((s) =>
  s === READY_STATUS ? [s, IN_PIPELINE_STAGE] : [s]
);

// Display label for a placement-stage option. `ready` is surfaced with the
// same friendly label as the programme dashboard; every other stage is
// title-cased so the selected value in the trigger matches the dropdown.
const stageLabel = (s) => {
  if (s === READY_STATUS) return 'Available for a project';
  if (s === IN_PIPELINE_STAGE) return 'In Selection';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function LeadershipCandidatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hubId, setHubId] = useState(searchParams.get('hubId') || '');
  const [internshipTypeId, setInternshipTypeId] = useState(
    searchParams.get('internshipTypeId') || ''
  );
  const [profileStatus, setProfileStatus] = useState(searchParams.get('status') || '');
  const [debouncedSearch] = useDebounce(search, 400);

  useEffect(() => {
    setHubId(searchParams.get('hubId') || '');
    setInternshipTypeId(searchParams.get('internshipTypeId') || '');
    setProfileStatus(searchParams.get('status') || '');
    setPage(1);
  }, [searchParams]);

  const { data: hubs = [] } = useHubs();
  const { data: types = [] } = useInternshipTypes();
  const {
    data,
    isPending: isPendingRaw,
    isError,
  } = useInterns({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    hubId: hubId || undefined,
    internshipTypeId: internshipTypeId || undefined,
    profileStatus: profileStatus && profileStatus !== IN_PIPELINE_STAGE ? profileStatus : undefined,
    // "ready" means the available bench: ready lifecycle status AND not already
    // in the pipeline, so the table matches the leadership "Ready" KPI count.
    inPipeline:
      profileStatus === IN_PIPELINE_STAGE
        ? 'true'
        : profileStatus === READY_STATUS
          ? 'false'
          : undefined,
  });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  const interns = data?.interns ?? [];
  const pagination = data?.pagination;
  const totalMatching = pagination?.total ?? 0;

  return (
    <div className="space-y-6">
      <SymphonyPageHeader
        kicker="Candidate directory"
        title="All programme candidates"
        subtitle="Search and filter the full roster. Programme metrics live on the dashboard."
      />

      <SymphonyCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* A bar rather than "Loading candidates…": the skeleton rows below already say the
              table is arriving, and a second sentence saying it again is the redundancy the
              text-only states were made of. */}
          {isPending ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {`${totalMatching} matching candidate${totalMatching === 1 ? '' : 's'}`}
            </p>
          )}
          <Link
            to="/programme"
            className="text-sm font-medium text-primary hover:underline"
            data-test="leadership-candidates-dashboard-link"
          >
            View programme dashboard
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            className="symphony-input"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            data-test="leadership-candidates-search-input"
          />
          <Select
            value={hubId || 'all'}
            onValueChange={(v) => {
              setHubId(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="symphony-input" data-test="leadership-candidates-hub-select">
              <SelectValue placeholder="All hubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All hubs</SelectItem>
              {hubs.map((hub) => (
                <SelectItem key={hub._id} value={hub._id}>
                  {hub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={internshipTypeId || 'all'}
            onValueChange={(v) => {
              setInternshipTypeId(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="symphony-input" data-test="leadership-candidates-type-select">
              <SelectValue placeholder="All programmes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programmes</SelectItem>
              {types.map((type) => (
                <SelectItem key={type._id} value={type._id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={profileStatus || 'all'}
            onValueChange={(v) => {
              setProfileStatus(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger
              className="symphony-input"
              data-test="leadership-candidates-status-select"
            >
              <SelectValue placeholder="Placement stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stageOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {stageLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SymphonyCard>

      {/* `relative` here, on the card, rather than on the scroll box below: an absolutely
          positioned child of a scroller is sized to its visible width and then scrolls away with
          the content, so on a narrow window the veil would cover the first screenful of an 880px
          table and leave the rest bare. Same arrangement `ReferenceDataPanel` uses. */}
      <SymphonyCard className="relative overflow-hidden p-0">
        {isError && (
          <p className="p-6 text-sm text-[hsl(var(--tone-danger-fg))]">
            Failed to load candidates.
          </p>
        )}
        {/* Header first, rows after — the five columns and their widths are known before the
            query answers, so nothing below the filter bar moves when it does. */}
        {!isError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="symphony-table-head border-b border-border/60">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Hub</th>
                  <th className="px-5 py-3">Programme</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Mentor</th>
                </tr>
              </thead>
              <tbody>
                {isPending && <TableRowsSkeleton rows={8} columns={5} firstColumn="person" />}
                {!isPending && interns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      No candidates match your filters.
                    </td>
                  </tr>
                )}
                {interns.map((intern) => {
                  const userId = intern.user?._id || intern.user;
                  return (
                    <tr
                      key={intern._id}
                      className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                      onClick={() => {
                        if (userId) navigate(`/interns/${userId}`);
                      }}
                      data-test={`leadership-candidate-row-${userId}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">{intern.user?.fullname}</p>
                        <p className="text-xs text-muted-foreground">{intern.user?.email}</p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {intern.user?.hub?.name || '—'}
                      </td>
                      <td className="px-5 py-4">{intern.internshipType?.name || '—'}</td>
                      <td className="px-5 py-4">
                        <SymphonyStatusBadge status={intern.status} />
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {intern.primaryMentor?.fullname || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Beside the table, not inside it: a `div` cannot sit in a `tbody`, so the veil is the
            scroller's sibling and the header stays legible through it. */}
        {isPending && <Loader variant="overlay" label="Loading candidates" />}
        {/* The pager's own height while the count is unknown — otherwise the row appears out of
            nowhere under the table, which is the shift the skeleton rows above prevent. */}
        {isPending && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-4">
            <Skeleton className="h-5 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-[var(--r-control)]" />
              <Skeleton className="h-8 w-20 rounded-[var(--r-control)]" />
            </div>
          </div>
        )}
        {!isPending && pagination && pagination.pages > 1 && (
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
                onClick={() => setPage((p) => p - 1)}
                data-test="leadership-candidates-prev-button"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                data-test="leadership-candidates-next-button"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </SymphonyCard>
    </div>
  );
}
