import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getRequestLockLabel } from '@/helpers/staffingRequests';
import { useReopenStaffingRequest } from '@/queries/staffingRequests';

/**
 * The actions leadership has on its own request:
 *
 *   edit / cancel   the author, open only
 *   reopen          the author, from any close reason
 *
 * Closing as `fulfilled` or `declined` is admin-only (`assertCanClose` in
 * server/helpers/staffingRequestRules.js) and deliberately absent here — this
 * page is the leadership portal, and admins answer requests from their own side
 * of the app. The server enforces that split regardless of what any screen
 * offers.
 *
 * A closed request shows why it is locked instead of disabled buttons: "Locked ·
 * declined" says more than a greyed-out Edit.
 */
export function RequestActions({ request, canManage, onEdit, onClose }) {
  const reopenMutation = useReopenStaffingRequest();

  const reopen = () =>
    reopenMutation.mutate(
      { id: request.id },
      {
        onSuccess: () => toast.success('Request reopened'),
        onError: (error) =>
          toast.error('Could not reopen the request', {
            description: error?.response?.data?.message,
          }),
      }
    );

  if (request.status === 'closed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Locked · {getRequestLockLabel(request).toLowerCase()}
          {request.closedBy?.fullname && ` by ${request.closedBy.fullname}`}
        </span>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reopen}
            disabled={reopenMutation.isPending}
            data-test="request-reopen"
          >
            {reopenMutation.isPending ? 'Reopening…' : 'Reopen'}
          </Button>
        )}
      </div>
    );
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onEdit(request)}
        data-test="request-edit"
      >
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onClose('cancelled')}
        data-test="request-cancel"
      >
        Cancel request
      </Button>
    </div>
  );
}
