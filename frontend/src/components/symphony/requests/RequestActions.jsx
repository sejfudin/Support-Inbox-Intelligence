import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getRequestLockLabel, isAwaitingProject } from '@/helpers/staffingRequests';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/helpers/roles';
import { ResolveProjectDialog } from './ResolveProjectDialog';

/**
 * The actions leadership has on its own request:
 *
 *   edit     the author, open only
 *   cancel   any leadership user, open only
 *
 * Cancel is deliberately wider than edit. Withdrawing an ask belongs to
 * leadership as a side, not to whoever's name is on the record — the author may
 * have left by the time the client pulls out — and the server agrees
 * (`assertCanClose` takes `isLeadership`, not `isAuthor`). Editing stays with
 * the author.
 *
 * Closing as `fulfilled` or `declined` is admin-only and deliberately absent
 * here — this page is the leadership portal, and admins answer requests from
 * their own side of the app. The server enforces that split regardless of what
 * any screen offers.
 *
 * "Resolve project" is admin-only for a different reason than `canManage`
 * gates the rest of this component — it is checked against the viewer's own
 * role right here, not passed in, so it still shows on the admin Requests
 * screen even though that screen renders with `canManage={false}`.
 *
 * There is no Reopen: a close resolves everyone still in selection, so a
 * reopened request would come back empty (ADR 0005). A closed request shows why
 * it is locked instead: "Locked · declined" says more than a greyed-out Edit.
 */
export function RequestActions({ request, canManage, onEdit, onClose }) {
  const { user } = useAuth();
  const [resolveOpen, setResolveOpen] = useState(false);

  const canResolveProject =
    user?.role === ROLES.ADMIN && request.status === 'open' && isAwaitingProject(request);
  const canCancel = user?.role === ROLES.LEADERSHIP && request.status !== 'closed';

  if (request.status === 'closed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Locked · {getRequestLockLabel(request).toLowerCase()}
          {request.closedBy?.fullname && ` by ${request.closedBy.fullname}`}
        </span>
      </div>
    );
  }

  if (!canManage && !canCancel && !canResolveProject) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(request)}
          data-test="request-edit"
        >
          Edit
        </Button>
      )}
      {canCancel && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onClose('cancelled')}
          data-test="request-cancel"
        >
          Cancel request
        </Button>
      )}
      {canResolveProject && (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => setResolveOpen(true)}
            data-test="request-resolve-project"
          >
            Resolve project
          </Button>
          <ResolveProjectDialog
            open={resolveOpen}
            onOpenChange={setResolveOpen}
            request={request}
          />
        </>
      )}
    </div>
  );
}
