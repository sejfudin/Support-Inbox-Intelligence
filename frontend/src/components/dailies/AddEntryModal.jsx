import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddDailyEntry } from '@/queries/dailies';
import { getAvailableInterns } from '@/helpers/dailyEntrants';

const entrySchema = z.object({
  member: z.string().min(1, 'Select an intern'),
  done: z.array(z.object({ value: z.string() })),
  todo: z.array(z.object({ value: z.string() })),
  blockers: z.array(z.object({ text: z.string() })),
});

const defaultValues = { member: '', done: [], todo: [], blockers: [] };

const RepeatableList = ({ label, name, control, register, addLabel }) => {
  const { fields, append, remove } = useFieldArray({ control, name });
  const fieldKey = name === 'blockers' ? 'text' : 'value';

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            {...register(`${name}.${index}.${fieldKey}`)}
            data-test={`daily-entry-${name}-input-${index}`}
            placeholder={label}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        data-test={`daily-entry-${name}-add`}
        onClick={() => append({ [fieldKey]: '' })}
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
};

export const AddEntryModal = ({ open, onOpenChange, workspaceId, daily }) => {
  const addEntryMutation = useAddDailyEntry(workspaceId);
  const availableInterns = getAvailableInterns(daily);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(entrySchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, reset]);

  const onSubmit = (values) => {
    const done = values.done.map((item) => item.value.trim()).filter(Boolean);
    const todo = values.todo.map((item) => item.value.trim()).filter(Boolean);
    const blockers = values.blockers
      .map((item) => ({ text: item.text.trim() }))
      .filter((item) => item.text);

    addEntryMutation.mutate(
      { dailyId: daily._id, member: values.member, done, todo, blockers },
      {
        onSuccess: () => {
          toast.success('Entry added');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Could not add entry', { description: error?.response?.data?.message });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-test="add-entry-modal">
        <DialogHeader>
          <DialogTitle>Add standup entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="daily-entry-member">Intern</Label>
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
            {errors.member && <p className="text-xs text-destructive">{errors.member.message}</p>}
          </div>

          <RepeatableList
            label="Done"
            name="done"
            control={control}
            register={register}
            addLabel="Add done item"
          />
          <RepeatableList
            label="To do"
            name="todo"
            control={control}
            register={register}
            addLabel="Add to do item"
          />
          <RepeatableList
            label="Blockers"
            name="blockers"
            control={control}
            register={register}
            addLabel="Add blocker"
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
            <Button
              type="submit"
              disabled={addEntryMutation.isPending}
              data-test="daily-entry-save"
            >
              {addEntryMutation.isPending ? 'Saving…' : 'Save entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
