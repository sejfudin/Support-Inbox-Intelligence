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
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { SymphonyStatusBadge } from '@/components/symphony/SymphonyStatusBadge';
import { useInterns } from '@/queries/interns';
import { useHubs } from '@/queries/hubs';
import { useInternshipTypes } from '@/queries/internshipTypes';

export default function LeadershipCandidatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hubId, setHubId] = useState('');
  const [internshipTypeId, setInternshipTypeId] = useState('');
  const [profileStatus, setProfileStatus] = useState(searchParams.get('status') || '');
  const [readyFilter, setReadyFilter] = useState(searchParams.get('ready') || '');
  const [debouncedSearch] = useDebounce(search, 400);

  useEffect(() => {
    setProfileStatus(searchParams.get('status') || '');
    setReadyFilter(searchParams.get('ready') || '');
    setPage(1);
  }, [searchParams]);

  const { data: hubs = [] } = useHubs();
  const { data: types = [] } = useInternshipTypes();
  const { data, isPending, isError } = useInterns({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    hubId: hubId || undefined,
    internshipTypeId: internshipTypeId || undefined,
    profileStatus: profileStatus || undefined,
    readyForPlacement: readyFilter || undefined,
  });

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
          <p className="text-sm text-muted-foreground">
            {isPending
              ? 'Loading candidates…'
              : `${totalMatching} matching candidate${totalMatching === 1 ? '' : 's'}`}
          </p>
          <Link
            to="/programme"
            className="text-sm font-medium text-primary hover:underline"
            data-test="leadership-candidates-dashboard-link"
          >
            View programme dashboard
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={readyFilter || 'all'}
            onValueChange={(v) => {
              setReadyFilter(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger
              className="symphony-input"
              data-test="leadership-candidates-ready-select"
            >
              <SelectValue placeholder="Placement readiness" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All readiness</SelectItem>
              <SelectItem value="true">Ready for placement</SelectItem>
              <SelectItem value="false">Not ready</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SymphonyCard>

      <SymphonyCard className="overflow-hidden p-0">
        {isError && <p className="p-6 text-sm text-destructive">Failed to load candidates.</p>}
        {isPending && <p className="p-6 text-sm text-muted-foreground">Loading candidates...</p>}
        {!isPending && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="symphony-table-head border-b border-border/60">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Hub</th>
                  <th className="px-5 py-3">Programme</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ready</th>
                  <th className="px-5 py-3">Mentor</th>
                </tr>
              </thead>
              <tbody>
                {interns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
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
                      <td className="px-5 py-4">
                        {intern.readyForPlacement ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
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
