import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Ban, FolderPlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getPositionProgressRows,
  getRequestLockLabel,
  getRequestTotals,
  isAwaitingProject,
} from '@/helpers/staffingRequests';
import { buildTechnologyIndex } from '@/helpers/technologyIcons';
import { useTechnologies } from '@/queries/technologies';
import { countStagedPicks } from '@/hooks/useStagedPicks';
import { SeatGroup } from '@/components/requests/SeatGroup';
import { RequestStatusChip } from '@/components/requests/RequestStatusChip';
import { RequestClosurePanel, RequestNoteCard } from '@/components/requests/RequestNoteCard';
import { CloseRequestDialog } from '@/components/symphony/requests/CloseRequestDialog';
import { ResolveProjectDialog } from '@/components/symphony/requests/ResolveProjectDialog';
import {
  formatDay,
  getNeededBy,
  getRequestBlocker,
  getRequestTitle,
} from '@/components/symphony/requests/requestPresentation';

const NOTICE_TONE = {
  warning:
    'border-[hsl(var(--tone-warning)/0.35)] bg-[hsl(var(--tone-warning)/0.1)] text-[hsl(var(--tone-warning-fg))]',
  success:
    'border-[hsl(var(--tone-success)/0.35)] bg-[hsl(var(--tone-success)/0.1)] text-[hsl(var(--tone-success-fg))]',
  info: 'border-[hsl(var(--tone-info)/0.35)] bg-[hsl(var(--tone-info)/0.1)] text-[hsl(var(--tone-info-fg))]',
};

const Blocker = ({ blocker, action }) => (
  <div
    className={cn(
      'flex items-start gap-2.5 rounded-[var(--r-card)] border px-3.5 py-3 text-[12.5px]',
      NOTICE_TONE[blocker.tone] ?? NOTICE_TONE.info
    )}
    data-test="request-blocker"
  >
    <blocker.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-2">
      <p>{blocker.text}</p>
      {action}
    </div>
  </div>
);

/**
 * The admin's side of a staffing request. Leadership's detail pane asks and
 * watches; this one fills seats and sends an answer, so the two do not share a
 * component — leadership's (`symphony/requests/RequestDetail`) stays exactly as
 * its own shell needs it.
 *
 * Picking writes nothing until `Submit to leadership`. Picks are staged into the
 * page's cart, and the submit sends the whole cart as one act: one insert, one
 * history event, one badge, however many seats it spans.
 *
 * The two ways an admin ends a request live here too — close as fulfilled, and
 * decline — because both are admin-only. Cancelling is leadership's and is
 * absent from this screen.
 *
 * Drawn with app tokens (`app-card`, `--tone-*`, `--primary`), not the symphony
 * surface: this page lives in the sidebar shell beside Attendance and Platform
 * Management, and it should read as one of them.
 */
export function RequestDetailPane({
  request,
  cart,
  onArm,
  onUnstage,
  onSubmit,
  isSubmitting,
  rejections,
}) {
  const [resolveOpen, setResolveOpen] = useState(false);
  // Which close dialog is open, if any: 'fulfilled' | 'declined' | null. The
  // admin owns both of those reasons; cancelling belongs to leadership and is
  // absent from this screen entirely.
  const [closeReason, setCloseReason] = useState(null);
  // Which cards the admin opened or closed by hand, `{ [positionId]: bool }`.
  // Absent means closed: every position starts compact, and the roster behind it
  // is opened on request. A request with four positions is then four readable
  // lines rather than a pane the admin has to scroll to see what it asked for.
  const [expandOverrides, setExpandOverrides] = useState({});

  const rows = getPositionProgressRows(request);
  const blocker = getRequestBlocker(request);
  const totals = getRequestTotals(request);
  const neededBy = getNeededBy(request);
  const stagedCount = countStagedPicks(cart);
  const isOpen = request.status !== 'closed';
  const needsProject = isAwaitingProject(request);
  const canStage = isOpen && !needsProject;

  // Only for the technology logos on the position headers — rows carry names, and
  // the icon map keys off slugs. Shared, long-cached query.
  const { data: allTechnologies = [] } = useTechnologies();
  const technologyIndex = useMemo(() => buildTechnologyIndex(allTechnologies), [allTechnologies]);

  // Closed unless the admin opened it — or unless it holds a pick the server
  // refused, which is the one thing that must not stay hidden.
  const hasRejection = (row) => (cart[row.id] ?? []).some((pick) => rejections[row.id]?.[pick.id]);
  const isExpanded = (row) => expandOverrides[row.id] ?? hasRejection(row);

  const setExpanded = useCallback(
    (positionId, next) => setExpandOverrides((current) => ({ ...current, [positionId]: next })),
    []
  );

  // A refused pick opens its own card, overriding a hand-collapse: the refusal
  // names a position, and a position the admin cannot see is the same as no
  // refusal at all.
  useEffect(() => {
    const refused = Object.keys(rejections);
    if (refused.length === 0) return;
    setExpandOverrides((current) => {
      const next = { ...current };
      refused.forEach((positionId) => delete next[positionId]);
      return next;
    });
  }, [rejections]);

  const anyExpanded = rows.some(isExpanded);
  const toggleAll = () =>
    setExpandOverrides(Object.fromEntries(rows.map((row) => [row.id, !anyExpanded])));

  return (
    <div className="app-card space-y-5 p-4 md:p-5">
      {/* Title first, filing details demoted to the line above it. The request is
          identified by its project, not by its status — the status is one fact
          about it, so it rides along with who filed it and when. */}
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-test={`request-detail-${request.id}`}
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <RequestStatusChip request={request} />
            <p className="text-[12.5px] text-muted-foreground">
              {`Filed ${formatDay(request.createdAt) ?? '—'}`}
              {request.author?.fullname && ` by ${request.author.fullname}`}
            </p>
            {request.project?._id && (
              <Link
                to={`/projects/${request.project._id}`}
                className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:underline"
              >
                View project
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {getRequestTitle(request)}
          </h2>

          {/* One line for where the request stands. `placed of wanted` leads
              because it is the only number that says whether the ask is answered
              — the rest are steps on the way there. */}
          <p className="text-[12.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {totals.placed} of {totals.wanted}
            </span>
            {` ${totals.wanted === 1 ? 'seat' : 'seats'} placed`}
            {totals.putForward > 0 && ` · ${totals.putForward} put forward`}
            {stagedCount > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-primary">{stagedCount} staged</span>
              </>
            )}
            {' · '}
            <span
              className={cn(neededBy.overdue && 'font-semibold text-[hsl(var(--tone-danger-fg))]')}
            >
              {neededBy.missing ? 'no needed-by date' : `due ${neededBy.short}`}
              {neededBy.sub && ` · ${neededBy.sub}`}
            </span>
          </p>
        </div>

        {/* One action slot, one action in it. A request that still names a project
            nobody created cannot be answered at all, so resolving it *is* the next
            step — offering both buttons made the admin choose between a live
            control and a dead one. Why it is dead is not spelled out beside the
            button either: the blocker banner below already says it, in more words
            than a button caption has room for. */}
        <div className="flex flex-col items-end gap-1.5">
          {!isOpen ? (
            <span className="text-[11.5px] text-muted-foreground">
              Locked · {getRequestLockLabel(request).toLowerCase()}
              {request.closedBy?.fullname && ` by ${request.closedBy.fullname}`}
            </span>
          ) : needsProject ? (
            <Button
              type="button"
              onClick={() => setResolveOpen(true)}
              className="gap-2"
              data-test="request-resolve-project"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Resolve project
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={stagedCount === 0 || isSubmitting}
              className="gap-2"
              data-test="submit-picks"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSubmitting
                ? 'Sending…'
                : stagedCount === 0
                  ? 'Submit to leadership'
                  : `Submit ${stagedCount} ${stagedCount === 1 ? 'pick' : 'picks'} to leadership`}
            </Button>
          )}
        </div>
      </div>

      <ResolveProjectDialog open={resolveOpen} onOpenChange={setResolveOpen} request={request} />
      <CloseRequestDialog
        open={Boolean(closeReason)}
        onOpenChange={(next) => !next && setCloseReason(null)}
        request={request}
        reason={closeReason}
      />

      {blocker && (
        <Blocker
          blocker={blocker}
          // Demand met is a prompt, never an action: nothing closes a request on
          // its own, because closing writes a mandatory reason onto other
          // people's records. So the banner carries the button that opens the
          // dialog — and only on this screen, because only an admin may fulfil.
          action={
            blocker.key === 'demand-met' ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCloseReason('fulfilled')}
                data-test="request-close-fulfilled"
              >
                Close as fulfilled
              </Button>
            ) : null
          }
        />
      )}

      {/* A decline's note is withheld here: the closure panel at the foot of the
          card is already showing that same text. */}
      {(isOpen || request.reason === 'cancelled') && <RequestNoteCard request={request} />}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="app-crumb">Seats asked for</p>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-[12px] font-medium text-primary hover:underline"
              data-test="toggle-all-positions"
            >
              {anyExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {rows.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No positions on this request.</p>
          ) : (
            rows.map((row) => (
              <SeatGroup
                key={row.id}
                row={row}
                stagedPicks={cart[row.id] ?? []}
                rejections={rejections[row.id] ?? {}}
                expanded={isExpanded(row)}
                onExpandedChange={(next) => setExpanded(row.id, next)}
                onArm={onArm}
                onUnstage={onUnstage}
                canStage={canStage}
                technologyIndex={technologyIndex}
              />
            ))
          )}
        </div>
      </div>

      {/* How it ended, for a request that has. Replaces the history trail, which
          listed the close as one event among equals and never said why. */}
      <RequestClosurePanel request={request} />

      {/* Answering "no" lives in its own footer, past the seats, rather than
          beside the primary action. Two reasons: it applies whichever action is
          in the slot — including on a request that still needs a project, which
          is exactly when an admin wants to decline and where the server allows it
          — and a destructive control directly beside "Submit 3 picks to
          leadership" is a misclick waiting to happen.
          Reached only after scrolling past what was asked for, which is the right
          order for refusing it. The prompt on the left is what makes the button
          legible on its own down here. */}
      {isOpen && (
        <div className="-mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-3 rounded-b-[inherit] border-t border-separator px-4 py-3.5 md:-mx-5 md:-mb-5 md:px-5">
          <p className="text-[12.5px] text-muted-foreground">Can’t staff this one?</p>
          {/* Outlined rather than red-on-white. It is destructive, but it sits
              alone in a footer with a prompt beside it — the weight it needed was
              "deliberate", not "alarming". The destructive colour arrives on
              hover, where the click is about to happen. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCloseReason('declined')}
            className="gap-2 hover:border-destructive/40 hover:bg-destructive/10 hover:text-[hsl(var(--tone-danger-fg))]"
            data-test="request-decline"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Decline this request
          </Button>
        </div>
      )}
    </div>
  );
}
