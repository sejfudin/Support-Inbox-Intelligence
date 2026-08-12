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

      <div className="divide-y divide-border/60 border-t border-border/60">
        {rows.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">No positions on this request.</p>
        ) : (
          rows.map((row) => <RequestPositionGroup key={row.id} row={row} />)
        )}
      </div>

      {/* Last, because it is the end of the story, and because on an open request
          there is nothing here at all. */}
      <RequestClosure request={request} />
    </SymphonyCard>
  );
}
