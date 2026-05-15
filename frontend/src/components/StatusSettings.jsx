import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TaskStatusEditor from '@/components/TaskStatusEditor';
import {
  useTaskStatusesQuery,
  useCreateTaskStatus,
  useUpdateTaskStatus,
  useDeleteTaskStatus,
  useReorderTaskStatuses,
} from '@/queries/taskStatuses';

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
  const { data: statuses = [], isLoading, refetch } = useTaskStatusesQuery(workspaceId);
  const [items, setItems] = useState([]);

  const createMutation = useCreateTaskStatus(workspaceId);
  const updateMutation = useUpdateTaskStatus(workspaceId);
  const deleteMutation = useDeleteTaskStatus(workspaceId);
  const reorderMutation = useReorderTaskStatuses(workspaceId);

  useEffect(() => {
    if (!isLoading) {
      setItems(statuses.map(toEditorItem));
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
        toast.error(err.response?.data?.message || 'Failed to create status');
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
          toast.error(err.response?.data?.message || 'Failed to delete status');
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
        toast.error(err.response?.data?.message || 'Failed to reorder statuses');
        setItems(statuses.map(toEditorItem));
      }
      return;
    }

    const updated = nextItems.find((next, index) => {
      const prev = items[index];
      if (!prev?._id || !next?._id) return false;
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
        toast.error(err.response?.data?.message || 'Failed to update status');
        setItems(statuses.map(toEditorItem));
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
        <h3 className="text-sm font-semibold text-gray-900">Task statuses</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize workflow columns, order, and behavior for this workspace.
        </p>
      </div>
      <TaskStatusEditor items={items} onChange={handleChange} minItems={1} />
    </div>
  );
};

export default StatusSettings;
