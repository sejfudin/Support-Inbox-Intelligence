import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollFade } from '@/components/ui/scroll-fade';
import TwoPaneSkeleton from '@/components/Skeletons/TwoPaneSkeleton';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { SymphonyPageHeader } from '@/components/symphony/SymphonyPageHeader';
import { RequestsFilterTabs } from '@/components/symphony/requests/RequestsFilterTabs';
import { RequestListItem } from '@/components/symphony/requests/RequestListItem';
import { RequestDetail } from '@/components/symphony/requests/RequestDetail';
import { RequestFormModal } from '@/components/symphony/requests/RequestFormModal';
import { CloseRequestDialog } from '@/components/symphony/requests/CloseRequestDialog';
import {
  SINGLE_PANE_QUERY,
  getRequestTitle,
} from '@/components/symphony/requests/requestPresentation';
import { useAuth } from '@/context/AuthContext';
import { useStaffingRequests } from '@/queries/staffingRequests';
import { useStaffingNewsMarkers } from '@/hooks/useStaffingNewsMarkers';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getRequestGroup } from '@/helpers/staffingRequests';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

const SORTS = {
  needed: 'Needed-by date',
  newest: 'Most recently filed',
};

// Sort has to cope with `neededBy` being absent. Undated requests sort last
// rather than reading as "needed right now" — a missing date is unknown urgency,
// not zero urgency.
const byNeededBy = (a, b) => {
  if (!a.neededBy && !b.neededBy) return 0;
  if (!a.neededBy) return 1;
  if (!b.neededBy) return -1;
  return new Date(a.neededBy) - new Date(b.neededBy);
};

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

const matchesQuery = (request, query) => {
  if (!query) return true;
  const haystack = [
    getRequestTitle(request),
    request.project?.client,
    request.draftProject?.client,
    request.author?.fullname,
    ...(request.requestedPositions ?? []).flatMap((requestedPosition) => [
      requestedPosition.position?.name,
      ...(requestedPosition.technologies ?? []).map((technology) => technology?.name),
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export default function LeadershipRequestsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('request');

  const [group, setGroup] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('needed');
  const [formState, setFormState] = useState({ open: false, request: null });
  const [closeReason, setCloseReason] = useState(null);

  const {
    data: requests = [],
    isPending: isPendingRaw,
    isError,
  } = useStaffingRequests({ mine: mineOnly });
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  // Opening the tab clears the badge — read state is tab-level, stamped once
  // per mount rather than on every render.
  const unreadRequestIds = useStaffingNewsMarkers();
  // Matches the `lg:` grid below — one column means list or detail, never both.
  const isSinglePane = useMediaQuery(SINGLE_PANE_QUERY);

  const currentUserId = user?._id ?? user?.id;
  const canFile = user?.role === 'leadership';

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter(
      (request) =>
        (group === 'all' || getRequestGroup(request) === group) && matchesQuery(request, query)
    );
    // Unread first, chosen sort within each half. Someone arriving off the
    // badge should not have to scroll a long list to find what moved.
    const bySort = sort === 'needed' ? byNeededBy : byNewest;
    return [...filtered].sort(
      (a, b) =>
        Number(unreadRequestIds.has(b.id)) - Number(unreadRequestIds.has(a.id)) || bySort(a, b)
    );
  }, [requests, group, query, sort, unreadRequestIds]);

  // The selected request comes from the full list, not the filtered one: opening
  // a request and then switching tabs shouldn't blank the pane. It only resets
  // when the id genuinely isn't in the data any more.
  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const selectRequest = (id) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (id) next.set('request', id);
        else next.delete('request');
        return next;
      },
      { replace: true }
    );
  };

  // Land on something rather than an empty pane, and drop a stale id (a
  // bookmarked request that has since gone) instead of showing nothing.
  //
  // Only where both panes are on screen. Below `lg` the list and the detail
  // are the same column, so auto-selecting would re-open the request the
  // moment `All requests` cleared it and the back button would look dead.
  useEffect(() => {
    if (isSinglePane || isPending || visibleRequests.length === 0) return;
    if (selectedId && requests.some((request) => request.id === selectedId)) return;
    selectRequest(visibleRequests[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSinglePane, isPending, selectedId, requests, visibleRequests]);

  // Author-only, because this route is leadership-only (see AppRoutes) and an
  // admin never lands here — they answer requests from their own side of the
  // app. The server still permits author-or-admin; this only narrows what the
  // screen offers, never what it allows.
  const canManage = Boolean(
    selected && String(selected.author?._id ?? selected.author) === String(currentUserId)
  );

  // Reached from the duplicate warning while filing: the request being pointed
  // at is someone else's and may sit outside the current filters, so clear them
  // rather than select an id the list won't show.
  const handleViewExisting = (id) => {
    if (!id) return;
    setMineOnly(false);
    setGroup('all');
    setQuery('');
    selectRequest(id);
  };

  return (
    <div className="space-y-6">
      <SymphonyPageHeader
        kicker="Future Experts Programme"
        title="Requests"
        subtitle="Seats you asked for, and who's been put forward."
        actions={
          canFile && (
            <Button
              type="button"
              onClick={() => setFormState({ open: true, request: null })}
              data-test="requests-file-button"
            >
              <Plus className="h-4 w-4" />
              New request
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RequestsFilterTabs requests={requests} value={group} onChange={setGroup} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search project, client or role…"
              className="w-56 pl-9"
              aria-label="Search requests"
              data-test="requests-search"
            />
          </div>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[190px]" aria-label="Sort requests">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Filter by author"
          >
            <Button
              type="button"
              size="sm"
              variant={!mineOnly ? 'default' : 'ghost'}
              onClick={() => setMineOnly(false)}
              data-test="requests-filter-author-all"
            >
              Everyone
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mineOnly ? 'default' : 'ghost'}
              onClick={() => setMineOnly(true)}
              data-test="requests-filter-mine"
            >
              Mine
            </Button>
          </div>
        </div>
      </div>

      {isError && (
        <SymphonyCard>
          <p className="text-sm text-[hsl(var(--tone-danger-fg))]">
            Failed to load staffing requests.
          </p>
        </SymphonyCard>
      )}

      {/* Same grid as the two panes below, so the list doesn't arrive and then shove the
          detail pane into place beside it. */}
      {isPending && (
        <LoadingOverlay label="Loading requests">
          <TwoPaneSkeleton columnsClassName="lg:grid-cols-[minmax(280px,340px)_1fr]" />
        </LoadingOverlay>
      )}

      {!isPending && requests.length === 0 && (
        <SymphonyCard className="py-12 text-center text-sm text-muted-foreground">
          {mineOnly ? 'You have not filed any requests yet.' : 'No staffing requests yet.'}
        </SymphonyCard>
      )}

      {!isPending && requests.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
          {/* On mobile the two panes collapse to one: the list hides once a
              request is open, with a back affordance above the detail. */}
          <div className={selected ? 'hidden lg:block' : 'block'}>
            {/* The pane caps its height on desktop, so the list has to advertise
                that it scrolls — the fade marks the edge that still has rows
                past it, and the count says how many there are in total. */}
            <ScrollFade
              viewportClassName="space-y-3 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1"
              fadeClassName="from-[hsl(var(--symphony-surface))]"
            >
              {visibleRequests.length === 0 ? (
                <SymphonyCard className="py-10 text-center text-sm text-muted-foreground">
                  {query ? 'Nothing matches that search.' : 'Nothing in this group right now.'}
                </SymphonyCard>
              ) : (
                visibleRequests.map((request) => (
                  <RequestListItem
                    key={request.id}
                    request={request}
                    selected={request.id === selectedId}
                    onSelect={selectRequest}
                    hasNews={unreadRequestIds.has(request.id)}
                  />
                ))
              )}
            </ScrollFade>
            {visibleRequests.length > 0 && (
              <p
                className="mt-2 text-xs text-muted-foreground lg:mt-3"
                data-test="requests-list-count"
              >
                {visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}
              </p>
            )}
          </div>

          {/* Same height and its own scrollbar as the list beside it, so the
              two panes start and end on the same line and a long request
              scrolls inside the card instead of pushing the page down past the
              list. The cap matches the list's viewport, not the list column —
              the count line below the list is what fills the remaining gap.

              No `space-y-*` here: the back button below is the first child and
              only `display: none` on desktop, which `space-y` still counts as a
              sibling — it would push the card down by a gap belonging to
              something nobody can see, and the two panes would start on
              different lines. The button carries its own margin instead. */}
          <div className="min-w-0 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
            {selected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 lg:hidden"
                onClick={() => selectRequest(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                All requests
              </Button>
            )}

            {selected ? (
              <RequestDetail
                request={selected}
                canManage={canManage}
                onEdit={(request) => setFormState({ open: true, request })}
                onClose={setCloseReason}
              />
            ) : (
              <SymphonyCard className="py-16 text-center text-sm text-muted-foreground">
                Pick a request to see who has been put forward.
              </SymphonyCard>
            )}
          </div>
        </div>
      )}

      <RequestFormModal
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        request={formState.request}
        onViewExisting={handleViewExisting}
      />

      <CloseRequestDialog
        open={Boolean(closeReason)}
        onOpenChange={(open) => !open && setCloseReason(null)}
        request={selected}
        reason={closeReason}
      />
    </div>
  );
}
