import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TicketStatusEditor from '@/components/TicketStatusEditor';
import { getApiErrorMessage } from '@/helpers/getApiErrorMessage';
import { getStatusesToPersist } from '@/helpers/statusBehaviorFlags';
import {
  useTicketStatusesQuery,
  useCreateTicketStatus,
  useUpdateTicketStatus,
  useDeleteTicketStatus,
  useReorderTicketStatuses,
} from '@/queries/ticketStatuses';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const toEditorItem = (status) => ({
  _id: status._id,
  label: status.label,
  color: status.color,
  isBacklog: status.isBacklog,
  tracksTime: status.tracksTime,
  isDone: status.isDone,
  slug: status.slug,
});

const needsReassign = (message = '') =>
  /still use|move them to|choose another status/i.test(message);

const statusFieldsChanged = (next, prev) =>
  next.label !== prev.label ||
  next.color !== prev.color ||
  next.isBacklog !== prev.isBacklog ||
  next.tracksTime !== prev.tracksTime ||
  next.isDone !== prev.isDone;

const getChangedStatuses = (nextItems, prevItems) =>
  nextItems.filter((next) => {
    if (!next?._id) return false;
    const prev = prevItems.find((item) => String(item._id) === String(next._id));
    if (!prev) return false;
    return statusFieldsChanged(next, prev);
  });

const StatusSettings = ({ workspaceId }) => {
  const { data: statuses = [], isLoading, refetch } = useTicketStatusesQuery(workspaceId);
  const [items, setItems] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [reassignTargetId, setReassignTargetId] = useState('');

  const createMutation = useCreateTicketStatus(workspaceId);
  const updateMutation = useUpdateTicketStatus(workspaceId);
  const deleteMutation = useDeleteTicketStatus(workspaceId);
  const reorderMutation = useReorderTicketStatuses(workspaceId);

  const resetFromServer = () => {
    setItems(statuses.map(toEditorItem));
  };

  useEffect(() => {
    if (!isLoading) {
      resetFromServer();
    }
  }, [statuses, isLoading]);

  const reassignOptions = statuses.filter((s) => String(s._id) !== String(pendingDelete?._id));

  const handleConfirmReassignDelete = async () => {
    if (!pendingDelete?._id || !reassignTargetId) return;

    try {
      await deleteMutation.mutateAsync({
        id: pendingDelete._id,
        reassignToStatusId: reassignTargetId,
      });
      toast.success('Status deleted and tickets reassigned');
      setPendingDelete(null);
      setReassignTargetId('');
      await refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete status'));
      resetFromServer();
    }
  };

  const handleChange = async (nextItems) => {
    const added = nextItems.filter((item) => !item._id);
    const previousDrafts = items.filter((item) => !item._id);

    if (added.length > previousDrafts.length) {
      const draft = added[added.length - 1];
      try {
        await createMutation.mutateAsync({
          workspaceId,
          label: draft.label,
          color: draft.color,
          isBacklog: draft.isBacklog,
          tracksTime: draft.tracksTime,
          isDone: draft.isDone,
        });
        toast.success('Status created');
        await refetch();
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to create status'));
        resetFromServer();
      }
      return;
    }

    if (nextItems.length < items.length) {
      const removed = items.find(
        (prev) => prev._id && !nextItems.some((next) => next._id === prev._id)
      );
      if (removed?._id) {
        try {
          await deleteMutation.mutateAsync({ id: removed._id });
          toast.success('Status deleted');
          await refetch();
        } catch (err) {
          const message = getApiErrorMessage(err, 'Failed to delete status');
          if (needsReassign(message)) {
            const targets = statuses.filter((s) => String(s._id) !== String(removed._id));
            setPendingDelete(removed);
            setReassignTargetId(targets[0]?._id ? String(targets[0]._id) : '');
          } else {
            toast.error(message);
            resetFromServer();
          }
        }
      }
      return;
    }

    const orderChanged =
      nextItems.length === items.length &&
      nextItems.some((item, index) => item._id !== items[index]?._id);

    if (orderChanged) {
      try {
        await reorderMutation.mutateAsync({
          workspaceId,
          orderedIds: nextItems.map((item) => item._id),
        });
        setItems(nextItems);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to reorder statuses'));
        resetFromServer();
      }
      return;
    }

    const changedStatuses = getChangedStatuses(nextItems, items);

    if (changedStatuses.length > 0) {
      const toPersist = getStatusesToPersist(changedStatuses, items);
      try {
        for (const item of toPersist) {
          await updateMutation.mutateAsync({
            id: item._id,
            label: item.label,
            color: item.color,
            isBacklog: item.isBacklog,
            tracksTime: item.tracksTime,
            isDone: item.isDone,
          });
        }
        toast.success(toPersist.length === 1 ? 'Status updated' : 'Statuses updated');
        await refetch();
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to update status'));
        resetFromServer();
      }
      return;
    }

    setItems(nextItems);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Ticket Statuses</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Customize workflow columns, order, and behavior.
        </p>
      </div>

      <TicketStatusEditor items={items} onChange={handleChange} minItems={1} />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setReassignTargetId('');
            resetFromServer();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign tickets before deleting</DialogTitle>
            <DialogDescription>
              Tickets still use &quot;{pendingDelete?.label}&quot;. Move them to another status,
              then delete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reassign-status">Move tickets to</Label>
            <Select value={reassignTargetId} onValueChange={setReassignTargetId}>
              <SelectTrigger id="reassign-status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {reassignOptions.map((status) => (
                  <SelectItem key={status._id} value={String(status._id)}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDelete(null);
                setReassignTargetId('');
                resetFromServer();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reassignTargetId || deleteMutation.isPending}
              onClick={handleConfirmReassignDelete}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Reassign and delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatusSettings;
