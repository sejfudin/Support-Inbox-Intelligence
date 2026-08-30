import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/Modals/ConfirmModal';
import { useCreateSprint, useDeleteSprint, useUpdateSprint } from '@/queries/sprints';
import { useSetSprintMembership, useTickets } from '@/queries/tickets';
import { SprintPlanningPicker } from '@/components/sprints/SprintPlanningPicker';

const schema = z.object({
  name: z.string().trim().min(1, 'Give the sprint a name'),
  start: z.string().min(1, 'Pick a start date'),
  end: z.string().min(1, 'Pick an end date'),
  goal: z.string().trim().optional(),
});

// Matches the picker's own page size — one workspace's sprint in a single read.
const SPRINT_TICKET_LIMIT = 500;

// A stored sprint date is an ISO instant at UTC midnight; DatePicker speaks
// 'yyyy-MM-dd'. Slicing the UTC date part avoids the local-timezone shift that
// `format(new Date(...))` would introduce west of Greenwich, which would show
// (and then save) the day before.
const toDateValue = (value) => (value ? String(value).slice(0, 10) : '');

const buildDefaults = (sprint, nextSprintName) => ({
  name: sprint ? sprint.name : nextSprintName || '',
  start: toDateValue(sprint?.start),
  end: toDateValue(sprint?.end),
  goal: sprint?.goal || '',
});

/**
 * The one sprint modal: `sprint` absent means create, `sprint` present means
 * edit the same form prefilled. It is deliberately not forked, so "add more
 * tickets later" is the same interaction as planning them in the first place.
 *
 * Delete lives here rather than on the page because it is the same decision:
 * the button is rendered only when the sprint's own `permissions.canDelete` says
 * so, which is false while it is active and false once it is past. The server
 * refuses either way — this only decides what is offered.
 */
export const SprintModal = ({ open, onOpenChange, workspaceId, nextSprintName, sprint = null }) => {
  const isEdit = Boolean(sprint?._id);
  const sprintId = sprint?._id ?? null;

  const createMutation = useCreateSprint(workspaceId);
  const updateMutation = useUpdateSprint(workspaceId);
  const deleteMutation = useDeleteSprint(workspaceId);
  const membershipMutation = useSetSprintMembership();

  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [committedTicketIds, setCommittedTicketIds] = useState([]);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // What the sprint holds right now, so edit mode can prefill the right pane and
  // the delete confirmation can say what is about to be detached. Archived
  // tickets are excluded, matching every other sprint number.
  const sprintTicketsQuery = useTickets(
    {
      workspaceId,
      sprintId,
      archived: false,
      limit: SPRINT_TICKET_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    { enabled: Boolean(open && workspaceId && sprintId) }
  );

  const sprintTickets = useMemo(
    () => (sprintId ? sprintTicketsQuery.data?.data || [] : []),
    [sprintId, sprintTicketsQuery.data]
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(sprint, nextSprintName),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(sprint, nextSprintName));
      setSelectedTicketIds([]);
      setCommittedTicketIds([]);
      setDeleteError('');
      setIsConfirmingDelete(false);
    }
  }, [open, sprintId, nextSprintName, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seeds the right pane once the sprint's tickets arrive. `committedTicketIds`
  // is the saved membership; `selectedTicketIds` is what the person has dragged
  // to. The difference between the two is what gets written on save.
  //
  // Guarded by a ref rather than by "is the selection still empty": dragging the
  // last ticket out of the sprint empties the selection, and that must not read
  // as "not seeded yet" and put every ticket straight back.
  const seededForRef = useRef(null);

  useEffect(() => {
    if (!open) {
      seededForRef.current = null;
      return;
    }
    if (!isEdit || !sprintTicketsQuery.isSuccess || seededForRef.current === sprintId) return;

    const ids = sprintTickets.map((ticket) => ticket._id);
    setCommittedTicketIds(ids);
    setSelectedTicketIds(ids);
    seededForRef.current = sprintId;
  }, [open, isEdit, sprintId, sprintTicketsQuery.isSuccess, sprintTickets]);

  const isSaving =
    createMutation.isPending || updateMutation.isPending || membershipMutation.isPending;

  const describeError = (error, fallback) => error?.response?.data?.message || fallback;

  // Two requests at most, and only for what actually changed: one batch joining
  // the sprint, one batch leaving it. Removal clears the sprint and leaves the
  // status alone, so a ticket taken out stays where it reached on the board.
  const writeMembership = useCallback(
    (targetSprintId, nextIds, committed, done) => {
      const added = nextIds.filter((id) => !committed.includes(id));
      const removed = committed.filter((id) => !nextIds.includes(id));

      const steps = [];
      if (added.length > 0) steps.push({ ticketIds: added, sprint: targetSprintId });
      if (removed.length > 0) steps.push({ ticketIds: removed, sprint: null });

      if (steps.length === 0) {
        done();
        return;
      }

      const run = (index) => {
        if (index >= steps.length) {
          done();
          return;
        }
        membershipMutation.mutate(
          { ...steps[index], workspaceId },
          {
            onSuccess: () => run(index + 1),
            onError: (error) => {
              // The sprint itself saved; only the picker's selection failed to
              // apply, so the modal stays open with that selection intact rather
              // than discarding it on what is likely a transient failure.
              toast.error('Sprint saved, but its tickets could not be updated', {
                description: describeError(error),
              });
            },
          }
        );
      };

      run(0);
    },
    [membershipMutation, workspaceId]
  );

  const onSubmit = (values) => {
    const payload = {
      name: values.name,
      start: values.start,
      end: values.end,
      goal: values.goal,
    };

    const finish = (message) => () => {
      toast.success(message);
      onOpenChange(false);
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: sprintId, ...payload },
        {
          onSuccess: () =>
            writeMembership(
              sprintId,
              selectedTicketIds,
              committedTicketIds,
              finish('Sprint updated')
            ),
          onError: (error) =>
            toast.error('Could not save sprint', { description: describeError(error) }),
        }
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: (response) => {
        const createdId = response?.data?._id;
        if (!createdId) {
          finish('Sprint created')();
          return;
        }
        writeMembership(createdId, selectedTicketIds, [], finish('Sprint created'));
      },
      onError: (error) =>
        toast.error('Could not create sprint', { description: describeError(error) }),
    });
  };

  const confirmDelete = () => {
    setDeleteError('');
    deleteMutation.mutate(
      { id: sprintId },
      {
        onSuccess: () => {
          setIsConfirmingDelete(false);
          onOpenChange(false);
          toast.success(`${sprint.name} deleted`);
        },
        onError: (error) => setDeleteError(describeError(error, 'Could not delete this sprint.')),
      }
    );
  };

  const heldCount = sprintTickets.length;
  const canDelete = isEdit && Boolean(sprint?.permissions?.canDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspace
          </span>
          <DialogTitle className="text-2xl">{isEdit ? sprint.name : 'New sprint'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex max-h-[calc(var(--app-vh)*0.75)] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sprint-name">Sprint name</Label>
                <Input
                  id="sprint-name"
                  data-test="sprint-name-input"
                  className="h-10"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-[hsl(var(--tone-danger-fg))]">{errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sprint-start">Starts</Label>
                <Controller
                  name="start"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="sprint-start"
                      value={field.value}
                      onChange={field.onChange}
                      data-test="sprint-start-input"
                    />
                  )}
                />
                {errors.start && (
                  <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                    {errors.start.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sprint-end">Ends</Label>
                <Controller
                  name="end"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="sprint-end"
                      value={field.value}
                      onChange={field.onChange}
                      data-test="sprint-end-input"
                    />
                  )}
                />
                {errors.end && (
                  <p className="text-xs text-[hsl(var(--tone-danger-fg))]">{errors.end.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sprint-goal">
                Sprint goal <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="sprint-goal"
                data-test="sprint-goal-input"
                placeholder="What should be true when this sprint ends?"
                {...register('goal')}
              />
            </div>

            <SprintPlanningPicker
              workspaceId={workspaceId}
              selectedIds={selectedTicketIds}
              onSelectedIdsChange={setSelectedTicketIds}
              extraTickets={sprintTickets}
            />
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-[11.5px] text-muted-foreground">
              Drag a card back to the left to take it out. You can add more from the backlog later.
            </p>
            <div className="flex gap-2">
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsConfirmingDelete(true)}
                  data-test="sprint-delete"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-test="sprint-create-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-test="sprint-create-save">
                {isEdit
                  ? isSaving
                    ? 'Saving…'
                    : 'Save sprint'
                  : isSaving
                    ? 'Creating…'
                    : 'Create sprint'}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {/* Rendered inside `DialogContent` on purpose. Radix's modal dialog
              makes everything outside it inert, so a confirm dialog mounted as a
              sibling would be visible but unclickable. It is `fixed inset-0`, so
              its position does not depend on where in the tree it sits. */}
        <ConfirmModal
          isOpen={isConfirmingDelete}
          onClose={() => setIsConfirmingDelete(false)}
          onConfirm={confirmDelete}
          isLoading={deleteMutation.isPending}
          errorMessage={deleteError}
          title={`Delete ${sprint?.name || 'sprint'}?`}
          description={
            heldCount === 0
              ? 'This sprint holds no tickets. Deleting it cannot be undone.'
              : `This sprint holds ${heldCount} ${heldCount === 1 ? 'ticket' : 'tickets'}. They will be taken out of the sprint and keep the status they are in — no work is lost.`
          }
          confirmLabel="Delete sprint"
          loadingLabel="Deleting…"
        />
      </DialogContent>
    </Dialog>
  );
};

export default SprintModal;
