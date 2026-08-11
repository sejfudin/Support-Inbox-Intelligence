import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SymphonyCard } from '@/components/symphony/SymphonyCard';
import { getPositionProgressRows } from '@/helpers/staffingRequests';
import { RequestActions } from './RequestActions';
import { RequestHistoryTrail } from './RequestHistoryTrail';
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

export function RequestDetail({ request, canManage, onEdit, onClose }) {
  const rows = getPositionProgressRows(request);
  const blocker = getRequestBlocker(request);
  const requestedPositionsById = new Map(
    (request.requestedPositions ?? []).map((requestedPosition) => [
      String(requestedPosition.position?._id ?? requestedPosition.position),
      requestedPosition,
    ])
  );

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

      {/* Why it was cancelled, kept apart from the admin's note — the two are
          different fields and different voices. */}
      {request.closeNote?.trim() && (
        <section className="space-y-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Why it was closed
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
            {request.closeNote}
          </p>
        </section>
      )}

      <RequestNote request={request} />

      <div className="divide-y divide-border/60 border-t border-border/60">
        {rows.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">No positions on this request.</p>
        ) : (
          rows.map((row) => (
            <RequestPositionGroup
              key={row.id}
              row={row}
              requestedPosition={requestedPositionsById.get(row.id)}
            />
          ))
        )}
      </div>

      <RequestHistoryTrail requestId={request.id} />
    </SymphonyCard>
  );
}
