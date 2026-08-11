import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TechnologyMultiSelect } from '@/components/ui/technology-multi-select';
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
import { useProjects } from '@/queries/projects';
import { usePositions } from '@/queries/positions';
import { useTechnologies } from '@/queries/technologies';
import { useCreateStaffingRequest, useUpdateStaffingRequest } from '@/queries/staffingRequests';

const requestedPositionSchema = z.object({
  position: z.string().min(1, 'Select a position'),
  count: z.coerce.number().int('Whole numbers only').min(1, 'At least 1'),
  technologies: z.array(z.string()).default([]),
});

const requestSchema = z
  .object({
    projectId: z.string().min(1, 'Select a project'),
    requestedPositions: z
      .array(requestedPositionSchema)
      .min(1, 'Add at least one requested position'),
    neededBy: z.string().nullable().default(null),
  })
  .refine(
    (values) =>
      new Set(values.requestedPositions.map((requestedPosition) => requestedPosition.position))
        .size === values.requestedPositions.length,
    { message: 'A position can only be requested once', path: ['requestedPositions'] }
  );

const emptyPositionRow = { position: '', count: 1, technologies: [] };

const defaultValues = {
  projectId: '',
  requestedPositions: [emptyPositionRow],
  neededBy: null,
};

const toFormValues = (request) => ({
  projectId: request.project?._id ?? '',
  requestedPositions: request.requestedPositions.map((requestedPosition) => ({
    position: requestedPosition.position?._id ?? '',
    count: requestedPosition.count,
    technologies: (requestedPosition.technologies ?? []).map((technology) => technology._id),
  })),
  neededBy: request.neededBy ? request.neededBy.slice(0, 10) : null,
});

const toPayload = (values) => ({
  requestedPositions: values.requestedPositions.map((requestedPosition) => ({
    position: requestedPosition.position,
    count: requestedPosition.count,
    technologies: requestedPosition.technologies,
  })),
  neededBy: values.neededBy || null,
});

/**
 * Files a new staffing request or edits an open one — same fields, project
 * picker only rendered (and only required) on file. Ticket 03 scope: no
 * draft-project path, that arrives with the admin-side project resolution
 * work in later tickets.
 */
export function RequestFormModal({ open, onOpenChange, request = null, onDuplicateWarning }) {
  const isEditing = Boolean(request);
  const { data: projectsData } = useProjects();
  const projects = projectsData?.data ?? projectsData ?? [];
  const { data: positions = [] } = usePositions();
  const { data: technologies = [] } = useTechnologies();
  const createMutation = useCreateStaffingRequest();
  const updateMutation = useUpdateStaffingRequest();
  const mutation = isEditing ? updateMutation : createMutation;

  const [selectedProject, setSelectedProject] = useState(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'requestedPositions' });

  useEffect(() => {
    if (!open) return;
    reset(isEditing ? toFormValues(request) : defaultValues);
    setSelectedProject(isEditing ? request.project : null);
  }, [open, isEditing, request, reset]);

  const positionOptions = useMemo(() => positions?.data ?? positions ?? [], [positions]);

  const onSubmit = (values) => {
    const payload = toPayload(values);

    if (isEditing) {
      updateMutation.mutate(
        { id: request.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Request updated');
            onOpenChange(false);
          },
          onError: (error) => {
            toast.error('Could not update request', {
              description: error?.response?.data?.message,
            });
          },
        }
      );
      return;
    }

    createMutation.mutate(
      { ...payload, projectId: values.projectId },
      {
        onSuccess: (data) => {
          toast.success('Request filed');
          onOpenChange(false);
          if (data.duplicateOf) {
            onDuplicateWarning?.(data.duplicateOf);
          }
        },
        onError: (error) => {
          toast.error('Could not file request', {
            description: error?.response?.data?.message,
          });
        },
      }
    );
  };

  const usedPositionIds = (index) =>
    fields
      .map((field, fieldIndex) => (fieldIndex === index ? null : field.position))
      .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-test="request-form-modal">
        <DialogHeader className="gap-1 border-b border-border/60 pb-4">
          <DialogTitle className="text-xl">
            {isEditing ? 'Edit staffing request' : 'File a staffing request'}
          </DialogTitle>
          <DialogDescription>
            One requested position per discipline — position, count, and optionally the technologies
            they should know.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>
              Project <span className="text-red-500">*</span>
            </Label>
            {isEditing ? (
              <div
                className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                data-test="request-form-project-locked"
              >
                {request.project?.name ?? 'Draft project'}
              </div>
            ) : (
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <div className="space-y-2">
                    {selectedProject ? (
                      <div className="flex items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        <span>{selectedProject.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setSelectedProject(null);
                            field.onChange('');
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <SearchableSelect
                        items={projects}
                        getLabel={(project) => project.name}
                        placeholder="Search projects…"
                        onSelect={(project) => {
                          setSelectedProject(project);
                          field.onChange(project._id);
                        }}
                        dataTest="request-form-project-search"
                      />
                    )}
                  </div>
                )}
              />
            )}
            {errors.projectId && (
              <p className="text-xs text-destructive">{errors.projectId.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>
              Requested positions <span className="text-red-500">*</span>
            </Label>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-wrap items-start gap-2 rounded-lg border border-border/60 p-3"
                data-test={`request-form-position-row-${index}`}
              >
                <Controller
                  name={`requestedPositions.${index}.position`}
                  control={control}
                  render={({ field: positionField }) => (
                    <Select onValueChange={positionField.onChange} value={positionField.value}>
                      <SelectTrigger
                        className="w-44"
                        data-test={`request-form-position-select-${index}`}
                      >
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positionOptions.map((position) => (
                          <SelectItem
                            key={position._id}
                            value={position._id}
                            disabled={usedPositionIds(index).includes(position._id)}
                          >
                            {position.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  data-test={`request-form-position-count-${index}`}
                  {...register(`requestedPositions.${index}.count`)}
                />
                <div className="min-w-[220px] flex-1">
                  <Controller
                    name={`requestedPositions.${index}.technologies`}
                    control={control}
                    render={({ field: techField }) => (
                      <TechnologyMultiSelect
                        technologies={technologies?.data ?? technologies ?? []}
                        selectedIds={techField.value}
                        onChange={techField.onChange}
                        variant="box"
                      />
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                  data-test={`request-form-position-remove-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append(emptyPositionRow)}
              className="flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
              data-test="request-form-position-add"
            >
              <Plus className="h-3.5 w-3.5" />
              Add requested position
            </button>
            {errors.requestedPositions && (
              <p className="text-xs text-destructive">
                {errors.requestedPositions.message ||
                  errors.requestedPositions.root?.message ||
                  'Check the requested positions'}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Needed by</Label>
            <Controller
              name="neededBy"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="No date given"
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-test="request-form-save">
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'File request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
