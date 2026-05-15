import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TicketStatusEditor from '@/components/TicketStatusEditor';
import { getApiErrorMessage } from '@/helpers/getApiErrorMessage';
import {
  useTicketStatusesQuery,
  useCreateTicketStatus,
  useUpdateTicketStatus,
  useDeleteTicketStatus,
  useReorderTicketStatuses,
} from '@/queries/ticketStatuses';

const toEditorItem = (status) => ({
  _id: status._id,
  label: status.label,
  color: status.color,
  isBacklog: status.isBacklog,
  tracksTime: status.tracksTime,
  isDone: status.isDone,
  slug: status.slug,
});

const StatusSettings = ({ workspaceId }) => {
  const { data: statuses = [], isLoading, refetch } = useTicketStatusesQuery(workspaceId);
  const [items, setItems] = useState([]);

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
          await deleteMutation.mutateAsync(removed._id);
          toast.success('Status deleted');
          await refetch();
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Failed to delete status'));
          resetFromServer();
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

    const updated = nextItems.find((next) => {
      if (!next?._id) return false;
      const prev = items.find((item) => item._id === next._id);
      if (!prev) return false;
      return (
        next.label !== prev.label ||
        next.color !== prev.color ||
        next.isBacklog !== prev.isBacklog ||
        next.tracksTime !== prev.tracksTime ||
        next.isDone !== prev.isDone
      );
    });

    if (updated?._id) {
      try {
        await updateMutation.mutateAsync({
          id: updated._id,
          label: updated.label,
          color: updated.color,
          isBacklog: updated.isBacklog,
          tracksTime: updated.tracksTime,
          isDone: updated.isDone,
        });
        setItems(nextItems);
        toast.success('Status updated');
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
          <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Ticket Statuses</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize workflow columns, order, and behavior for this workspace.
        </p>
      </div>
      <TicketStatusEditor items={items} onChange={handleChange} minItems={1} />
    </div>
  );
};

export default StatusSettings;
