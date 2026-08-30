import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import { useCreateSprint } from '@/queries/sprints';
import { useSetSprintMembership } from '@/queries/tickets';
import { SprintPlanningPicker } from '@/components/sprints/SprintPlanningPicker';

const schema = z.object({
  name: z.string().trim().min(1, 'Give the sprint a name'),
  start: z.string().min(1, 'Pick a start date'),
  end: z.string().min(1, 'Pick an end date'),
  goal: z.string().trim().optional(),
});

const buildDefaults = (nextSprintName) => ({
  name: nextSprintName || '',
  start: '',
  end: '',
  goal: '',
});

// Create-only for this ticket — editing an existing sprint reuses this same
// modal in a later ticket, prefilled instead of defaulted.
export const CreateSprintModal = ({ open, onOpenChange, workspaceId, nextSprintName }) => {
  const mutation = useCreateSprint(workspaceId);
  const membershipMutation = useSetSprintMembership();
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(nextSprintName),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(nextSprintName));
      setSelectedTicketIds([]);
    }
  }, [open, nextSprintName, reset]);

  const isSaving = mutation.isPending || membershipMutation.isPending;

  const onSubmit = (values) => {
    const finish = () => {
      toast.success('Sprint created');
      onOpenChange(false);
    };

    mutation.mutate(
      { name: values.name, start: values.start, end: values.end, goal: values.goal },
      {
        onSuccess: (response) => {
          const sprintId = response?.data?._id;

          if (selectedTicketIds.length === 0 || !sprintId) {
            finish();
            return;
          }

          membershipMutation.mutate(
            { ticketIds: selectedTicketIds, sprint: sprintId, workspaceId },
            {
              onSuccess: finish,
              onError: (error) => {
                // The sprint itself was created; only the picker's selection failed to
                // attach, so the modal stays open with that selection intact instead of
                // discarding it on what is likely a transient failure.
                toast.error('Sprint created, but adding tickets to it failed', {
                  description: error?.response?.data?.message,
                });
              },
            }
          );
        },
        onError: (error) => {
          toast.error('Could not create sprint', {
            description: error?.response?.data?.message,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspace
          </span>
          <DialogTitle className="text-2xl">New sprint</DialogTitle>
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
            />
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-[11.5px] text-muted-foreground">
              Drag a card back to the left to take it out. You can add more from the backlog later.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-test="sprint-create-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-test="sprint-create-save">
                {isSaving ? 'Creating…' : 'Create sprint'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
