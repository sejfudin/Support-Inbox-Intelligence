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
import { Skeleton } from '@/components/ui/skeleton';
import TableRowsSkeleton from '@/components/Skeletons/TableRowsSkeleton';
import { useInterns } from '@/queries/interns';
import { useHubs } from '@/queries/hubs';
import { useInternshipTypes } from '@/queries/internshipTypes';
import { INTERN_STATUSES } from '@/helpers/internProfile';
import { Loader, useLoaderHold } from '@/components/ui/loader';

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
    profileStatus: profileStatus || undefined,
  });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });

  const interns = data?.interns ?? [];
  const pagination = data?.pagination;

  return (
    <PageShell>
      <PageSection className="space-y-6">
        <PageHeading
          crumb="Mentoring"
          title="My interns"
          subtitle="Interns assigned to you as primary or secondary mentor."
        />

        <div className="app-card space-y-4 p-5 md:p-6">
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
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* `relative` here, on the card, rather than on the scroll box below: an absolutely
            positioned child of a scroller is sized to its visible width and then scrolls away with
            the content, so on a narrow window the veil would cover the first screenful of a 720px
            table and leave the rest bare. Same arrangement `ReferenceDataPanel` uses. */}
        <div className="app-card relative overflow-hidden">
          {isError && (
            <p
              className="p-6 text-sm text-[hsl(var(--tone-danger-fg))]"
              data-test="mentor-interns-error"
            >
              Failed to load interns.
            </p>
          )}
          {/* The header is static and the column widths are fixed, so both render straight
              away and only the rows wait — this is a mentor's landing page, and it used to
              open on one line of grey text. */}
          {!isError && (
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
                  {isPending && <TableRowsSkeleton rows={6} columns={5} firstColumn="person" />}
                  {!isPending && interns.length === 0 && (
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
                        <td className="px-5 py-4 capitalize">{intern.status}</td>
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
          {/* Beside the table, not inside it: a `div` cannot sit in a `tbody`, so the veil is the
              scroller's sibling and the header stays legible through it. */}
          {isPending && <Loader variant="overlay" label="Loading your interns" />}
          {/* The pager's own height while the count is unknown. Without it the row appears out of
              nowhere under the table the moment the page lands, which is the shift the skeleton
              rows above are there to prevent. */}
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
