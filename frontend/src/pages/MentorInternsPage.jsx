import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import PageHeading from '@/components/PageHeading';
import { PageShell, PageSection } from '@/components/PageShell';
import { useInterns } from '@/queries/interns';
import { useHubs } from '@/queries/hubs';
import { useInternshipTypes } from '@/queries/internshipTypes';
import { INTERN_STATUSES } from '@/helpers/internProfile';

export default function MentorInternsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hubId, setHubId] = useState('');
  const [internshipTypeId, setInternshipTypeId] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [debouncedSearch] = useDebounce(search, 400);

  const { data: hubs = [] } = useHubs();
  const { data: types = [] } = useInternshipTypes();
  const { data, isPending, isError } = useInterns({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    hubId: hubId || undefined,
    internshipTypeId: internshipTypeId || undefined,
    profileStatus: profileStatus || undefined,
  });

  const interns = data?.interns ?? [];
  const pagination = data?.pagination;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          kicker="Future Experts Program"
          title="My interns"
          subtitle="Interns assigned to you as primary or secondary mentor."
        />

        <div className="app-panel space-y-4 p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              data-test="mentor-interns-search-input"
            />
            <Select
              value={hubId || 'all'}
              onValueChange={(v) => {
                setHubId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger data-test="mentor-interns-hub-filter-select">
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
              <SelectTrigger data-test="mentor-interns-type-filter-select">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
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
              <SelectTrigger data-test="mentor-interns-status-filter-select">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {INTERN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="app-panel overflow-hidden">
          {isError && (
            <p className="p-6 text-sm text-destructive" data-test="mentor-interns-error">
              Failed to load interns.
            </p>
          )}
          {isPending && (
            <p className="p-6 text-sm text-muted-foreground">Loading your interns...</p>
          )}
          {!isPending && !isError && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-foreground">Intern</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Hub</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Programme</th>
                    <th className="px-5 py-3 font-semibold text-foreground">Status</th>
                    <th className="px-5 py-3 font-semibold text-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {interns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                        No assigned interns match your filters.
                      </td>
                    </tr>
                  )}
                  {interns.map((intern) => {
                    const userId = intern.user?._id || intern.user;
                    return (
                      <tr
                        key={intern._id}
                        className="cursor-pointer border-t border-border/60 hover:bg-muted/30"
                        onClick={() => navigate(`/my-interns/${userId}`)}
                        data-test={`mentor-intern-row-${userId}`}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{intern.user?.fullname}</p>
                          <p className="text-xs text-muted-foreground">{intern.user?.email}</p>
                        </td>
                        <td className="px-5 py-4">{intern.user?.hub?.name || '—'}</td>
                        <td className="px-5 py-4">{intern.internshipType?.name || '—'}</td>
                        <td className="px-5 py-4">{intern.status}</td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-test={`mentor-intern-row-${userId}-view-button`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/my-interns/${userId}`);
                            }}
                          >
                            View
                          </Button>
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
                  data-test="mentor-interns-prev-page-button"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  data-test="mentor-interns-next-page-button"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
