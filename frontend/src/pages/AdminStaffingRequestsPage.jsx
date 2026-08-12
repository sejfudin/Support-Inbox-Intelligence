import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollFade } from '@/components/ui/scroll-fade';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import PageHeading from '@/components/PageHeading';
import { RequestsFilterTabs } from '@/components/symphony/requests/RequestsFilterTabs';
import { RequestListItem } from '@/components/symphony/requests/RequestListItem';
import { AdminRequestDetail } from '@/components/symphony/requests/AdminRequestDetail';
import { AdminCandidateRail } from '@/components/symphony/requests/AdminCandidateRail';
import {
  useMarkStaffingRequestsSeen,
  usePutInternsForward,
  useStaffingRequestNews,
  useStaffingRequests,
} from '@/queries/staffingRequests';
import {
  EMPTY_CART,
  countStagedPicks,
  stagedInternIds,
  toPutForwardGroups,
  useStagedPicks,
} from '@/hooks/useStagedPicks';
import { getRequestGroup } from '@/helpers/staffingRequests';

const matchesQuery = (request, query) => {
  if (!query) return true;
  const haystack = [
    request.project?.name,
    request.draftProject?.name,
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

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

/**
 * The admin-side Requests view: a work surface, not a scorecard. Leadership
 * files demand and watches it; the admin fills seats and sends one answer, so
 * this page no longer renders leadership's `RequestDetail` — it has its own
 * (`AdminRequestDetail`) plus a candidate rail beside it.
 *
 * Putting interns forward is staged, not immediate. Picks collect in a cart
 * held here — keyed by request id, mirrored to `sessionStorage`, deliberately
 * never persisted server-side (ticket 08) — and only `Submit to leadership`
 * writes anything. That is why the cart lives at page level rather than in the
 * rail: the list badges requests with unsent picks, the detail pane counts
 * them, and the rail reads them back as "already staged".
 *
 * Wrapped in its own `data-surface="symphony"` scope since the `symphony-*`
 * styles are keyed off that attribute and this page lives in the sidebar shell,
 * not `SymphonyLayout`.
 */
export default function AdminStaffingRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('request');

  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  // The requested position the candidate rail is filtered to. Staging is always
  // against one requested position, never against the request as a whole.
  const [armedRow, setArmedRow] = useState(null);
  // Per-row refusals from the last submit, keyed positionId → internProfileId.
  // A pick can go stale while it is staged, and the admin needs to know which
  // pick — not that something, somewhere, was wrong.
  const [rejections, setRejections] = useState({});

  const { data: requests = [], isPending, isError } = useStaffingRequests();
  const { data: news } = useStaffingRequestNews();
  const unreadRequestIds = useMemo(() => new Set(news?.requestIds ?? []), [news]);

  const { carts, togglePick, clearRequest } = useStagedPicks();
  const submitMutation = usePutInternsForward();

  const markSeenMutation = useMarkStaffingRequestsSeen();
  const hasMarkedSeen = useRef(false);
  useEffect(() => {
    if (hasMarkedSeen.current) return;
    hasMarkedSeen.current = true;
    markSeenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter(
      (request) =>
        (group === 'all' || getRequestGroup(request) === group) && matchesQuery(request, query)
    );
    return [...filtered].sort(byNewest);
  }, [requests, group, query]);

  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const cart = carts[selectedId] ?? EMPTY_CART;

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

  useEffect(() => {
    if (isPending || visibleRequests.length === 0) return;
    if (selectedId && requests.some((request) => request.id === selectedId)) return;
    selectRequest(visibleRequests[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, selectedId, requests, visibleRequests]);

  // Which seat is armed, and any refusals, belong to the request being looked
  // at. The cart does not — it survives the move, which is the whole point.
  useEffect(() => {
    setArmedRow(null);
    setRejections({});
  }, [selectedId]);

  const stagedForSeat = useMemo(
    () => new Set((cart[armedRow?.id] ?? []).map((pick) => pick.id)),
    [cart, armedRow]
  );
  const stagedElsewhere = useMemo(() => {
    const all = stagedInternIds(cart);
    stagedForSeat.forEach((id) => all.delete(id));
    return all;
  }, [cart, stagedForSeat]);

  // Only the row that was touched loses its marker. Clearing them all would
  // mean an admin with two stale picks drops the first, loses sight of the
  // second, and submits straight back into the same refusal.
  const clearRejection = useCallback(
    (positionId, internProfileId) =>
      setRejections((current) => {
        if (!current[positionId]?.[internProfileId]) return current;
        const forPosition = { ...current[positionId] };
        delete forPosition[internProfileId];
        const next = { ...current };
        if (Object.keys(forPosition).length === 0) delete next[positionId];
        else next[positionId] = forPosition;
        return next;
      }),
    []
  );

  const onToggleCandidate = useCallback(
    (candidate) => {
      if (!selectedId || !armedRow) return;
      clearRejection(armedRow.id, candidate.internProfile);
      togglePick(selectedId, armedRow.id, {
        id: candidate.internProfile,
        name: candidate.internName,
        technologies: candidate.technologies ?? [],
        startDate: candidate.startDate ?? null,
      });
    },
    [selectedId, armedRow, togglePick, clearRejection]
  );

  const onUnstage = useCallback(
    (positionId, pick) => {
      if (!selectedId) return;
      clearRejection(positionId, pick.id);
      togglePick(selectedId, positionId, pick);
    },
    [selectedId, togglePick, clearRejection]
  );

  const onSubmit = async () => {
    const groups = toPutForwardGroups(cart);
    const total = countStagedPicks(cart);
    setRejections({});
    try {
      await submitMutation.mutateAsync({ id: selectedId, groups });
      clearRequest(selectedId);
      setArmedRow(null);
      toast.success(total === 1 ? '1 intern put forward' : `${total} interns put forward`);
    } catch (error) {
      const rows = error?.response?.data?.data?.rejections;
      if (rows?.length) {
        // Nothing was created — the server applies a submit all-or-nothing — so
        // the cart is left exactly as it was, with the bad rows marked.
        setRejections(
          rows.reduce(
            (byPosition, row) => ({
              ...byPosition,
              [row.positionId]: {
                ...(byPosition[row.positionId] ?? {}),
                [row.internProfileId]: row.reason,
              },
            }),
            {}
          )
        );
        toast.error('Some picks went stale', {
          description: 'Nothing was sent. Drop the flagged picks and submit again.',
        });
        return;
      }
      toast.error('Could not put anyone forward', {
        description: error?.response?.data?.message,
      });
    }
  };

  return (
    // `PageHeading` inside `app-page`, the same header every other route in the
    // sidebar shell uses. `SymphonyPageHeader` is the leadership shell's, and
    // this page only ever borrowed it because it renders leadership's data.
    <div data-surface="symphony" className="app-page">
      <div className="app-page-content space-y-6">
        <PageHeading
          kicker="Future Experts Programme"
          title="Requests"
          subtitle="Every staffing request from every leadership user."
          actions={
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search project, client or role…"
                className="pl-9"
                aria-label="Search requests"
                data-test="admin-requests-search"
              />
            </div>
          }
        />

        <RequestsFilterTabs requests={requests} value={group} onChange={setGroup} />

        {isError && (
          <SymphonyCard>
            <p className="text-sm text-destructive">Failed to load staffing requests.</p>
          </SymphonyCard>
        )}

        {isPending && <p className="text-sm text-muted-foreground">Loading requests…</p>}

        {!isPending && requests.length === 0 && (
          <SymphonyCard className="py-12 text-center text-sm text-muted-foreground">
            No staffing requests yet.
          </SymphonyCard>
        )}

        {!isPending && requests.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(320px,360px)]">
            <div className={selected ? 'hidden lg:block' : 'block'}>
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
                      stagedCount={countStagedPicks(carts[request.id])}
                    />
                  ))
                )}
              </ScrollFade>
              {visibleRequests.length > 0 && (
                <p
                  className="mt-2 text-xs text-muted-foreground lg:mt-3"
                  data-test="admin-requests-list-count"
                >
                  {visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}
                </p>
              )}
            </div>

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
                <AdminRequestDetail
                  request={selected}
                  cart={cart}
                  armedRow={armedRow}
                  onArm={setArmedRow}
                  onUnstage={onUnstage}
                  onSubmit={onSubmit}
                  isSubmitting={submitMutation.isPending}
                  rejections={rejections}
                />
              ) : (
                <SymphonyCard className="py-16 text-center text-sm text-muted-foreground">
                  Pick a request to see its details.
                </SymphonyCard>
              )}
            </div>

            {/* The rail sits below the detail until there is room for a third
                column — squeezed beside it, the conflict warnings clip, and they
                are the one string here that must stay readable. */}
            {selected && (
              <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:max-h-[calc(100vh-18rem)] xl:overflow-y-auto xl:pr-1">
                <AdminCandidateRail
                  request={selected}
                  row={armedRow}
                  stagedIdsForSeat={stagedForSeat}
                  stagedIdsElsewhere={stagedElsewhere}
                  onToggle={onToggleCandidate}
                  onClearSeat={() => setArmedRow(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
