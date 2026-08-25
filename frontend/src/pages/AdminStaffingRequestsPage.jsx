import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TwoPaneSkeleton from '@/components/Skeletons/TwoPaneSkeleton';
import { ScrollFade } from '@/components/ui/scroll-fade';
import PageHeading from '@/components/PageHeading';
import { RequestGroupTabs } from '@/components/requests/RequestGroupTabs';
import { RequestCard } from '@/components/requests/RequestCard';
import { RequestDetailPane } from '@/components/requests/RequestDetailPane';
import { PutForwardDialog } from '@/components/symphony/requests/PutForwardDialog';
import { usePutInternsForward, useStaffingRequests } from '@/queries/staffingRequests';
import { useStaffingNewsMarkers } from '@/hooks/useStaffingNewsMarkers';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SINGLE_PANE_QUERY } from '@/components/symphony/requests/requestPresentation';
import {
  EMPTY_CART,
  countStagedPicks,
  toPutForwardGroups,
  useStagedPicks,
} from '@/hooks/useStagedPicks';
import { getRequestGroup } from '@/helpers/staffingRequests';
import { LoadingOverlay, useLoaderHold } from '@/components/ui/loader';

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
 * this page renders its own detail pane (`components/requests/`) rather than
 * leadership's.
 *
 * Putting interns forward is staged, not immediate. Picks collect in a cart
 * held here — keyed by request id, mirrored to `sessionStorage`, deliberately
 * never persisted server-side (ticket 08) — and only `Submit to leadership`
 * writes anything. That is why the cart lives at page level rather than in the
 * detail pane: the list badges requests with unsent picks, the pane counts them,
 * and the picker reads them back as "already staged".
 *
 * ── Why this page is not on the symphony surface ─────────────────────────────
 *
 * It used to declare `data-surface="symphony"` and borrow leadership's
 * components. That attribute switches on a whole second design system — its own
 * font, palette, card shapes, radii and a `--primary` override — so this one
 * route looked like a different product from Attendance and Platform Management
 * either side of it in the same sidebar. Everything it draws now lives in
 * `components/requests/` and uses the app's own tokens.
 *
 * `components/symphony/requests/` is untouched and still leadership's: the
 * duplication is deliberate, because the two shells are genuinely different
 * designs over the same data. What IS still shared is the logic — the
 * presentation helpers, the staged-picks hook, and the three dialogs.
 */
export default function AdminStaffingRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('request');

  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  // The requested position the picker is open against — and, being nullable,
  // the picker's own open state. Staging is always against one requested
  // position, never against the request as a whole.
  const [pickerRow, setPickerRow] = useState(null);
  // Per-row refusals from the last submit, keyed positionId → internProfileId.
  // A pick can go stale while it is staged, and the admin needs to know which
  // pick — not that something, somewhere, was wrong.
  const [rejections, setRejections] = useState({});
  // Every recommendation a submit creates pre-fills from the request's own
  // project. Ticking this discards that pre-fill for the whole submit,
  // asserting the picks' project as not known yet instead.
  const [projectUnknown, setProjectUnknown] = useState(false);

  const { data: requests = [], isPending: isPendingRaw, isError } = useStaffingRequests();
  // Global hold: keeps the mark up for MIN_VISIBLE_MS once it appears, and until the data is in.
  const isPending = useLoaderHold(isPendingRaw, { release: isError });
  const unreadRequestIds = useStaffingNewsMarkers();
  // Matches the `lg:` grid below — one column means list or detail, never both.
  const isSinglePane = useMediaQuery(SINGLE_PANE_QUERY);

  const { carts, togglePick, setPositionPicks, clearRequest } = useStagedPicks();
  const submitMutation = usePutInternsForward();

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter(
      (request) =>
        (group === 'all' || getRequestGroup(request) === group) && matchesQuery(request, query)
    );
    // Unread first, newest within each half. An admin arriving off the badge
    // should not have to scroll a long list to find what moved.
    return [...filtered].sort(
      (a, b) =>
        Number(unreadRequestIds.has(b.id)) - Number(unreadRequestIds.has(a.id)) || byNewest(a, b)
    );
  }, [requests, group, query, unreadRequestIds]);

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

  // Only where both panes are on screen. Below `lg` the list and the detail
  // are the same column, so auto-selecting would re-open the request the
  // moment `All requests` cleared it and the back button would look dead.
  useEffect(() => {
    if (isSinglePane || isPending || visibleRequests.length === 0) return;
    if (selectedId && requests.some((request) => request.id === selectedId)) return;
    selectRequest(visibleRequests[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSinglePane, isPending, selectedId, requests, visibleRequests]);

  // Which seat is armed, and any refusals, belong to the request being looked
  // at. The cart does not — it survives the move, which is the whole point.
  useEffect(() => {
    setPickerRow(null);
    setRejections({});
    setProjectUnknown(false);
  }, [selectedId]);

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

  // The picker assembles a shortlist as its own draft and hands the whole list
  // over on save, so this replaces the position's picks rather than toggling
  // one. Cancelling in the picker never reaches here — that is the point of it
  // holding a draft.
  const onSavePicks = useCallback(
    (positionId, picks) => {
      if (!selectedId) return;
      const keptIds = new Set(picks.map((pick) => pick.id));
      // A dropped pick takes its stale-pick marker with it. A kept one keeps its
      // marker: the reason the server refused it has not gone away just because
      // the admin opened the picker again.
      setRejections((current) => {
        const forPosition = current[positionId];
        if (!forPosition) return current;
        const remaining = Object.fromEntries(
          Object.entries(forPosition).filter(([internProfileId]) => keptIds.has(internProfileId))
        );
        const next = { ...current };
        if (Object.keys(remaining).length === 0) delete next[positionId];
        else next[positionId] = remaining;
        return next;
      });
      setPositionPicks(selectedId, positionId, picks);
    },
    [selectedId, setPositionPicks]
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
      await submitMutation.mutateAsync({ id: selectedId, groups, projectUnknown });
      clearRequest(selectedId);
      setPickerRow(null);
      setProjectUnknown(false);
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
    // No `data-surface="symphony"`. This page renders leadership's data but it
    // lives in the sidebar shell next to Attendance and Platform Management, and
    // the symphony surface is a whole second design system — its own font,
    // palette, card shapes and `--primary` override — which made this one route
    // look like a different product. It now draws with the app's own tokens; the
    // leadership shell keeps symphony and its own copies of these components.
    <div className="app-page">
      {/* `pb-0`, never `py-0` — `.app-page-header` pulls itself up by 24px and
          needs the section's top padding left in place to land flush instead of
          being clipped. */}
      <div className="app-page-content pb-0">
        <PageHeading
          // `crumb`, not `kicker` — `kicker` is not a `PageHeading` prop, so this
          // page has been rendering no eyebrow at all while every other admin
          // route shows one.
          crumb="Admin"
          title="Requests"
          subtitle="Every staffing request from every leadership user."
          actions={
            <div className="relative w-full md:w-[260px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search project, client or role…"
                className="pl-[30px] text-[12.5px] md:text-[12.5px]"
                aria-label="Search requests"
                data-test="admin-requests-search"
              />
            </div>
          }
        />

        {/* The page's tab band — group tabs left, match count right, the same
            strip every other admin route carries under its header. The count is
            the search-narrowed one, which the tab counts (stored status only)
            deliberately are not. */}
        <RequestGroupTabs
          requests={requests}
          value={group}
          onChange={setGroup}
          rightSlot={
            !isPending && (
              <span
                className="text-[12.5px] text-muted-foreground"
                data-test="admin-requests-list-count"
              >
                {visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}
              </span>
            )
          }
        />

        <div className="space-y-4 py-[18px]">
          {isError && (
            <div className="app-card p-5">
              <p className="text-[12.5px] text-[hsl(var(--tone-danger-fg))]">
                Failed to load staffing requests.
              </p>
            </div>
          )}

          {/* Shaped like the grid it replaces, so the two panes don't jump into
            place — a single "Loading requests…" line left the page empty and
            then rearranged it. */}
          {isPending && (
            <LoadingOverlay label="Loading requests">
              <TwoPaneSkeleton />
            </LoadingOverlay>
          )}

          {!isPending && requests.length === 0 && (
            <div className="app-card py-12 text-center text-[12.5px] text-muted-foreground">
              No staffing requests yet.
            </div>
          )}

          {!isPending && requests.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <div className={selected ? 'hidden lg:block' : 'block'}>
                <ScrollFade
                  viewportClassName="space-y-2.5 lg:max-h-[calc(var(--app-vh)-16rem)] lg:overflow-y-auto lg:pr-1"
                  fadeClassName="from-background"
                >
                  {visibleRequests.length === 0 ? (
                    <div className="app-card py-10 text-center text-[12.5px] text-muted-foreground">
                      {query ? 'Nothing matches that search.' : 'Nothing in this group right now.'}
                    </div>
                  ) : (
                    visibleRequests.map((request) => (
                      <RequestCard
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
              </div>

              <div className="min-w-0 lg:max-h-[calc(var(--app-vh)-16rem)] lg:overflow-y-auto lg:pr-1">
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
                  <RequestDetailPane
                    request={selected}
                    cart={cart}
                    onArm={setPickerRow}
                    onUnstage={onUnstage}
                    onSubmit={onSubmit}
                    isSubmitting={submitMutation.isPending}
                    rejections={rejections}
                    projectUnknown={projectUnknown}
                    onProjectUnknownChange={setProjectUnknown}
                  />
                ) : (
                  <div className="app-card py-16 text-center text-[12.5px] text-muted-foreground">
                    Pick a request to see its details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The candidate picker is still a symphony component — it is the biggest
          surface in this feature and shares nothing with the panes around it, so
          it is the one piece left to convert. It needs the attribute for two
          reasons: every `--symphony-*` variable it paints with is scoped to this
          selector, and it retargets its own Radix portal by querying for exactly
          this node. `display: contents` gives it that host without putting a
          box, a background or a min-height into the page's layout. */}
      <div data-surface="symphony" className="contents">
        <PutForwardDialog
          open={Boolean(pickerRow)}
          onOpenChange={(next) => !next && setPickerRow(null)}
          request={selected}
          row={pickerRow}
          cart={cart}
          onSave={onSavePicks}
        />
      </div>
    </div>
  );
}
