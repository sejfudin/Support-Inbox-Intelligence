import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getPositionProgressRows } from '@/helpers/staffingRequests';
import { RequestActions } from './RequestActions';
import { RequestClosure } from './RequestClosure';
import { RequestNote } from './RequestNote';
import { RequestPositionGroup } from './RequestPositionGroup';
import { RequestStatStrip } from './RequestStatStrip';
import { RequestStatusBadge } from './RequestStatusBadge';
import { formatDay, getRequestBlocker, getRequestTitle } from './requestPresentation';

const Blocker = ({ blocker }) => (
  <div
    className={cn(
      'symphony-notice',
      blocker.tone === 'warning' && 'symphony-notice-warning',
      blocker.tone === 'success' && 'symphony-notice-success',
      blocker.tone === 'info' && 'symphony-notice-info'
    )}
    data-test="request-blocker"
  >
    <blocker.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <p>{blocker.text}</p>
  </div>
);

/**
 * Leadership's view of a request: what was asked for, and how far it has got.
 * Nothing here writes against a requested position — putting interns forward is
 * the admin's answer, and it lives on the admin's own pane
 * (`AdminRequestDetail`), which is a work surface rather than this scorecard.
 */
export function RequestDetail({ request, canManage, onEdit, onClose }) {
  const rows = getPositionProgressRows(request);
  const blocker = getRequestBlocker(request);

  // Which cards the reader has opened, `{ [positionId]: bool }`. Absent means
  // closed: every position starts compact, so a four-position request is four
  // readable lines rather than a pane to scroll before seeing what was asked for.
  // Owned here rather than in the card so `Collapse all` can mean something.
  const [expanded, setExpandedState] = useState({});
  const setExpanded = useCallback(
    (positionId, next) => setExpandedState((current) => ({ ...current, [positionId]: next })),
    []
  );
  const anyExpanded = rows.some((row) => expanded[row.id]);
  const toggleAll = () =>
    setExpandedState(Object.fromEntries(rows.map((row) => [row.id, !anyExpanded])));

  return (
    <SymphonyCard className="space-y-5">
      <div
        className="flex flex-wrap items-start justify-between gap-3"
        data-test={`request-detail-${request.id}`}
      >
        <RequestStatusBadge request={request} />
        <RequestActions request={request} canManage={canManage} onEdit={onEdit} onClose={onClose} />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {getRequestTitle(request)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {`Filed ${formatDay(request.createdAt) ?? '—'}`}
          {request.author?.fullname && ` by ${request.author.fullname}`}
          {request.project?._id && (
            <>
              {' · '}
              <Link to={`/projects/${request.project._id}`} className="symphony-link">
                View project
              </Link>
            </>
          )}
        </p>
      </div>

      {blocker && <Blocker blocker={blocker} />}

      <RequestStatStrip request={request} />

      {/* The admin's note, except when it IS the close reason — a decline stores
          its mandatory reason in `note`, and the closure panel below already
          gives that text the prominence it earned. A cancellation keeps both:
          `closeNote` is why the ask went away, `note` is what the admin said
          about it, two fields and two voices. */}
      {(request.status !== 'closed' || request.reason === 'cancelled') && (
        <RequestNote request={request} />
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          {/* Not "Seats asked for": the stat strip above already owns that label
              for its count, and the same words twice on one card read as the
              same thing twice. These are the positions themselves. */}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Positions
          </p>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground"
              data-test="toggle-all-positions"
            >
              {anyExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        {/* One card per requested position, each opening on its own — the same
            unit the admin fills, so both sides talk about the same objects. A
            divided list read as one long form. */}
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No positions on this request.</p>
          ) : (
            rows.map((row) => (
              <RequestPositionGroup
                key={row.id}
                row={row}
                expanded={Boolean(expanded[row.id])}
                onExpandedChange={(next) => setExpanded(row.id, next)}
              />
            ))
          )}
        </div>
      </div>

      {/* Last, because it is the end of the story, and because on an open request
          there is nothing here at all. */}
      <RequestClosure request={request} />
    </SymphonyCard>
  );
}
