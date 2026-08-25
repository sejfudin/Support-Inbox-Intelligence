import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddDailyEntry, useUpdateDailyEntry } from '@/queries/dailies';
import { useTickets } from '@/queries/tickets';
import { getAvailableInterns } from '@/helpers/dailyEntrants';
import { cn } from '@/lib/utils';

const entrySchema = z.object({
  member: z.string().min(1, 'Select an intern'),
  done: z.array(z.object({ value: z.string() })),
  todo: z.array(z.object({ value: z.string() })),
  blockers: z.array(
    z.object({
      // Required even when a ticket is linked — a blocker whose text is empty
      // used to be dropped silently on both sides of the wire and rendered as
      // nothing. The ticket picker prefills this, so linking a ticket still
      // costs no typing.
      text: z.string().trim().min(1, 'Describe the blocker'),
      linkedTicket: z.string().nullable(),
    })
  ),
});

const defaultValues = { member: '', done: [], todo: [], blockers: [] };

const SectionLabel = ({ dotColor, children }) => (
  <div className="flex items-center gap-2 text-sm font-semibold">
    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor)} />
    {children}
  </div>
);

const AddItemLink = ({ onClick, tone = 'primary', children, ...props }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-1 self-start text-sm font-medium hover:underline',
      tone === 'destructive' ? 'text-[hsl(var(--tone-danger-fg))]' : 'text-primary'
    )}
    {...props}
  >
    <Plus className="h-3.5 w-3.5" />
    {children}
  </button>
);

const RepeatableList = ({ label, dotColor, name, control, register, addLabel, placeholder }) => {
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel dotColor={dotColor}>{label}</SectionLabel>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            {...register(`${name}.${index}.value`)}
            data-test={`daily-entry-${name}-input-${index}`}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-test={`daily-entry-${name}-remove-${index}`}
            onClick={() => remove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <AddItemLink data-test={`daily-entry-${name}-add`} onClick={() => append({ value: '' })}>
        {addLabel}
      </AddItemLink>
    </div>
  );
};

const NO_TICKET = 'none';

// The ticket picker prefills the text field, so linking a ticket needs no
// typing — but only into an empty field, so it never overwrites what the intern
// wrote. Switching tickets afterwards therefore leaves the earlier text in
// place; the intern edits it if it no longer fits.
const blockerTicketText = (ticket) => `Blocked by ticket #${ticket.taskNumber}`;

const BlockersField = ({ control, register, workspaceId, errors, getValues, setValue }) => {
  const { fields, append, remove } = useFieldArray({ control, name: 'blockers' });
  const { data } = useTickets({ workspaceId, limit: 200 }, { enabled: Boolean(workspaceId) });
  const tickets = data?.data ?? [];

  const prefillText = (index, ticketId) => {
    if (!ticketId) return;
    if (getValues(`blockers.${index}.text`)?.trim()) return;
    const ticket = tickets.find((item) => item._id === ticketId);
    if (!ticket) return;
    setValue(`blockers.${index}.text`, blockerTicketText(ticket), { shouldValidate: true });
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel dotColor="bg-[hsl(var(--tone-danger))]">Blockers</SectionLabel>
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              {...register(`blockers.${index}.text`)}
              data-test={`daily-entry-blockers-input-${index}`}
              placeholder="Describe the blocker…"
              className="flex-1"
            />
            <Controller
              name={`blockers.${index}.linkedTicket`}
              control={control}
              render={({ field: ticketField }) => (
                <Select
                  value={ticketField.value ?? NO_TICKET}
                  onValueChange={(value) => {
                    const ticketId = value === NO_TICKET ? null : value;
                    ticketField.onChange(ticketId);
                    prefillText(index, ticketId);
                  }}
                >
                  <SelectTrigger
                    className="w-44 shrink-0"
                    data-test={`daily-entry-blockers-ticket-${index}`}
                  >
                    <SelectValue placeholder="Link ticket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TICKET}>No ticket</SelectItem>
                    {tickets.map((ticket) => (
                      <SelectItem
                        key={ticket._id}
                        value={ticket._id}
                        data-test={`daily-entry-blockers-ticket-option-${ticket._id}`}
                      >
                        #{ticket.taskNumber} {ticket.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-test={`daily-entry-blockers-remove-${index}`}
              onClick={() => remove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {errors?.blockers?.[index]?.text && (
            <p
              data-test={`daily-entry-blockers-error-${index}`}
              className="text-xs text-[hsl(var(--tone-danger-fg))]"
            >
              {errors.blockers[index].text.message}
            </p>
          )}
        </div>
      ))}
      <AddItemLink
        tone="destructive"
        data-test="daily-entry-blockers-add"
        onClick={() => append({ text: '', linkedTicket: null })}
      >
        Add blocker
      </AddItemLink>
    </div>
  );
};

export const AddEntryModal = ({
  open,
  onOpenChange,
  workspaceId,
  daily,
  entry = null,
  date = new Date(),
}) => {
  const isEditing = Boolean(entry);
  const { user } = useAuth();
  const addEntryMutation = useAddDailyEntry(workspaceId);
  const updateEntryMutation = useUpdateDailyEntry(workspaceId);
  const mutation = isEditing ? updateEntryMutation : addEntryMutation;
  const availableInterns = getAvailableInterns(daily);

  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      isEditing
        ? {
            member: entry.member._id,
            done: (entry.done ?? []).map((value) => ({ value })),
            todo: (entry.todo ?? []).map((value) => ({ value })),
            blockers: (entry.blockers ?? []).map((blocker) => ({
              text: blocker.text,
              linkedTicket: blocker.linkedTicket?._id ?? null,
            })),
          }
        : defaultValues
    );
  }, [open, isEditing, entry, reset]);

  const onSubmit = (values) => {
    const done = values.done.map((item) => item.value.trim()).filter(Boolean);
    const todo = values.todo.map((item) => item.value.trim()).filter(Boolean);
    // No .filter() on text here: the schema requires it, so an empty blocker
    // surfaces as a field error instead of disappearing on the way out.
    const blockers = values.blockers.map((item) => ({
      text: item.text.trim(),
      linkedTicket: item.linkedTicket ?? null,
    }));

    const payload = isEditing
      ? { dailyId: daily._id, entryId: entry._id, done, todo, blockers }
      : { dailyId: daily._id, member: values.member, done, todo, blockers };

    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEditing ? 'Entry updated' : 'Entry added');
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(isEditing ? 'Could not update entry' : 'Could not add entry', {
          description: error?.response?.data?.message,
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-test="add-entry-modal">
        <DialogHeader className="gap-1 border-b border-border/60 pb-4">
          <DialogTitle className="text-xl">
            {isEditing ? 'Edit standup entry' : 'Add standup entry'}
          </DialogTitle>
          <DialogDescription>
            {format(date, 'EEEE, MMMM d, yyyy')} · logged by {user?.fullname}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-entry-member">
              Team member <span className="text-[hsl(var(--tone-danger))]">*</span>
            </Label>
            {isEditing ? (
              <div
                className="flex h-10 items-center rounded-[var(--r-control)] border border-input bg-muted px-3 text-sm text-muted-foreground"
                data-test="daily-entry-member-locked"
              >
                {entry.member?.fullname}
              </div>
            ) : (
              <Controller
                name="member"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="daily-entry-member" data-test="daily-entry-member-select">
                      <SelectValue placeholder="Select an intern" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInterns.map((intern) => (
                        <SelectItem
                          key={intern._id}
                          value={intern._id}
                          data-test={`daily-entry-member-option-${intern._id}`}
                        >
                          {intern.fullname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.member && (
              <p className="text-xs text-[hsl(var(--tone-danger-fg))]">{errors.member.message}</p>
            )}
          </div>

          <RepeatableList
            label="Done"
            dotColor="bg-[hsl(var(--tone-success))]"
            name="done"
            control={control}
            register={register}
            addLabel="Add item"
            placeholder="What was completed…"
          />
          <RepeatableList
            label="To do"
            dotColor="bg-[hsl(var(--tone-info))]"
            name="todo"
            control={control}
            register={register}
            addLabel="Add item"
            placeholder="Planned for today…"
          />
          <BlockersField
            control={control}
            register={register}
            workspaceId={workspaceId}
            errors={errors}
            getValues={getValues}
            setValue={setValue}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-test="daily-entry-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-test="daily-entry-save">
              {mutation.isPending ? 'Saving…' : 'Save entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
