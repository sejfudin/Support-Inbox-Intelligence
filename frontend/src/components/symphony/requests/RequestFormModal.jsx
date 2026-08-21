import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HelpCircle, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  SelectedTechnologyChips,
  TechnologyMultiSelect,
} from '@/components/ui/technology-multi-select';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjects } from '@/queries/projects';
import { usePositions } from '@/queries/positions';
import { useTechnologies } from '@/queries/technologies';
import {
  useCreateStaffingRequest,
  useStaffingRequests,
  useUpdateStaffingRequest,
} from '@/queries/staffingRequests';
import { DuplicateRequestDialog } from './DuplicateRequestDialog';
import { EditImpactDialog } from './EditImpactDialog';
import {
  describePlacedRefusal,
  getEditImpact,
  getPlacedPositionLocks,
} from '@/helpers/staffingRequests';

const requestedPositionSchema = z.object({
  position: z.string().min(1, 'Select a position'),
  count: z.coerce.number().int('Whole numbers only').min(1, 'At least 1'),
  technologies: z.array(z.string()).default([]),
});

const draftProjectSchema = z.object({
  name: z.string().trim().min(1, "Name the project you're asking for"),
  client: z.string().trim().default(''),
  description: z.string().trim().default(''),
});

// A request needs a project either way — picked from the list, or described
// as a draft when the project doesn't exist yet (see draftProject on the
// server model). An edit may repoint a request at a different project, but it
// can never switch between the two modes: naming the *first* project is
// resolution, which is the admin's (see ResolveProjectDialog).
const requestSchema = z
  .object({
    projectMode: z.enum(['existing', 'draft']).default('existing'),
    projectId: z.string().default(''),
    draftProject: draftProjectSchema.nullable().default(null),
    requestedPositions: z
      .array(requestedPositionSchema)
      .min(1, 'Add at least one requested position'),
    neededBy: z.string().nullable().default(null),
  })
  .superRefine((values, ctx) => {
    if (values.projectMode === 'existing' && !values.projectId) {
      ctx.addIssue({ code: 'custom', message: 'Select a project', path: ['projectId'] });
    }
    // `draftProject.name` already carries its own min-length message when
    // draft mode has an object to validate; nothing to add here.
    if (
      new Set(values.requestedPositions.map((requestedPosition) => requestedPosition.position))
        .size !== values.requestedPositions.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'A position can only be requested once',
        path: ['requestedPositions'],
      });
    }
  });

const emptyPositionRow = { position: '', count: 1, technologies: [] };
const emptyDraftProject = { name: '', client: '', description: '' };

/** Row control class shared by the position / seats / technologies cells. */
const rowControlClass = 'h-11 rounded-xl border-input/90';

// The column headers and the rows below them are separate grids, so the seats
// track has to be an explicit width rather than `auto`: sized to content, each
// grid measures its own column and the "Technologies" header drifts off the
// picker it labels. 6.25rem is the stepper (two 2.25rem buttons + a 1.5rem
// readout) with its border.
const positionGridClass = 'grid grid-cols-[minmax(0,1fr)_6.25rem_minmax(0,1.3fr)_2rem] gap-3';

/**
 * Seats are almost always a single digit, so the row spends its width on the
 * two fields that need it and gives the count a stepper instead of a text box.
 */
function SeatStepper({ value, onChange, index }) {
  const seats = Number(value) || 1;
  const step = (delta) => onChange(Math.max(1, seats + delta));

  return (
    <div
      className="flex h-11 items-center rounded-xl border border-input/90"
      data-test={`request-form-position-count-${index}`}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={seats <= 1}
        aria-label="One seat fewer"
        className="flex h-full w-9 items-center justify-center rounded-l-xl text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        data-test={`request-form-position-count-decrement-${index}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{seats}</span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="One more seat"
        className="flex h-full w-9 items-center justify-center rounded-r-xl text-muted-foreground transition hover:text-foreground"
        data-test={`request-form-position-count-increment-${index}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * The three fields describing a project the platform doesn't have yet. Rendered
 * while filing in draft mode, and again on every edit of a request that carries
 * them — including one already resolved to a real project, whose draft details
 * remain the record of what was originally asked for.
 */
function DraftProjectFields({ control, errors }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Name <span className="text-[hsl(var(--tone-danger-fg))]">*</span>
          </Label>
          <Controller
            name="draftProject.name"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                maxLength={160}
                placeholder="Kestrel"
                className="h-11 w-full rounded-xl border border-input/90 bg-transparent px-3.5 text-sm outline-none focus-visible:border-primary"
                data-test="request-form-draft-name"
              />
            )}
          />
          {errors.draftProject?.name && (
            <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
              {errors.draftProject.name.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Client <span className="font-normal text-muted-foreground">· optional</span>
          </Label>
          <Controller
            name="draftProject.client"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                maxLength={160}
                placeholder="Kestrel Fintech"
                className="h-11 w-full rounded-xl border border-input/90 bg-transparent px-3.5 text-sm outline-none focus-visible:border-primary"
                data-test="request-form-draft-client"
              />
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Description <span className="font-normal text-muted-foreground">· optional</span>
        </Label>
        <Controller
          name="draftProject.description"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              maxLength={2000}
              rows={3}
              placeholder="What the team will be working on — helps mentors pick the right people."
              className="w-full resize-none rounded-xl border border-input/90 bg-transparent px-3.5 py-2.5 text-sm outline-none focus-visible:border-primary"
              data-test="request-form-draft-description"
            />
          )}
        />
      </div>
    </>
  );
}

const defaultValues = {
  projectMode: 'existing',
  projectId: '',
  draftProject: null,
  requestedPositions: [emptyPositionRow],
  neededBy: null,
};

// A resolved request keeps the draft details it was filed with, and they stay
// editable: freezing them was meant to preserve what was originally asked for,
// and the history trail does that better by showing both versions.
const toFormValues = (request) => ({
  projectMode: request.project ? 'existing' : 'draft',
  projectId: request.project?._id ?? '',
  draftProject: request.draftProject ?? null,
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

const toDraftPayload = (draftProject) => ({
  name: draftProject.name.trim(),
  client: draftProject.client?.trim() || '',
  description: draftProject.description?.trim() || '',
});

// An edit sends whichever halves of the project the request has: the real one
// it may have been repointed to, the draft details it may have had corrected,
// or — for a request resolved out of a draft — both.
const toEditPayload = (values) => ({
  ...toPayload(values),
  ...(values.projectMode === 'existing' ? { projectId: values.projectId } : {}),
  ...(values.draftProject ? { draftProject: toDraftPayload(values.draftProject) } : {}),
});

/**
 * Files a new staffing request or edits an open one — same fields either way.
 * Filing offers a choice: pick an existing project, or describe one that
 * doesn't exist yet (`draftProject`) — the admin resolves that later (see
 * ResolveProjectDialog). An edit keeps whichever half the request already has:
 * the project may be repointed, the draft details corrected, but the toggle
 * between them is filing-only.
 *
 * An edit that costs something — candidates closed out because a position
 * stopped being asked for, recommendations moved because the project did —
 * goes through EditImpactDialog first, and one that isn't legal at all (a
 * position someone is placed against) is stopped here with the same sentence
 * the server would answer with.
 */
export function RequestFormModal({
  open,
  onOpenChange,
  request = null,
  initialProject = null,
  onViewExisting,
}) {
  const isEditing = Boolean(request);
  const { data: projectsData } = useProjects();
  const projects = projectsData?.data ?? projectsData ?? [];
  const { data: positions = [] } = usePositions();
  const { data: technologies = [] } = useTechnologies();
  const createMutation = useCreateStaffingRequest();
  const updateMutation = useUpdateStaffingRequest();
  const mutation = isEditing ? updateMutation : createMutation;

  const [selectedProject, setSelectedProject] = useState(null);
  const [duplicateWarn, setDuplicateWarn] = useState(null);
  const [impactWarn, setImpactWarn] = useState(null);

  // Open demand already recorded against the project being filed for. Filing
  // only: an edit may now repoint the project, but "someone already asked for
  // this" is a question about a new ask, and answering it for a repoint would
  // offer "view the existing one instead" for a request being corrected.
  const { data: openForProject = [] } = useStaffingRequests(
    { status: 'open', projectId: selectedProject?._id },
    { enabled: open && !isEditing && Boolean(selectedProject?._id) }
  );
  // The oldest one, not the newest: "someone already asked for this" is a
  // question about who got there first.
  const existingOpenRequest = openForProject.reduce(
    (oldest, candidate) =>
      !oldest || new Date(candidate.createdAt) < new Date(oldest.createdAt) ? candidate : oldest,
    null
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'requestedPositions' });

  useEffect(() => {
    if (!open) return;
    reset(
      isEditing ? toFormValues(request) : { ...defaultValues, projectId: initialProject?._id ?? '' }
    );
    setSelectedProject(isEditing ? request.project : initialProject);
    setDuplicateWarn(null);
    setImpactWarn(null);
  }, [open, isEditing, request, initialProject, reset]);

  const positionOptions = useMemo(() => positions?.data ?? positions ?? [], [positions]);

  // A position with someone placed against it can't be changed or removed. The
  // refusal used to arrive as a toast on save, after the change had been made
  // and the form looked willing — so the row says so instead, and its controls
  // stop offering the edit that cannot happen. Seats stay editable: lowering a
  // count closes out nobody, and it is the escape hatch for a shrinking ask.
  const placedLocks = useMemo(
    () => (isEditing ? getPlacedPositionLocks(request) : []),
    [isEditing, request]
  );
  const lockFor = (positionId) =>
    placedLocks.find((lock) => lock.id === String(positionId ?? '')) ?? null;

  // The technology list is active-only, but a request can carry one that was
  // deactivated after it was filed. Without merging those back in, the picker
  // renders no chip for them — the ask looks like it lost a technology it is
  // still about to re-submit. (The server exempts them from its active check
  // for the same reason.) They stay out of the add-list only while selected,
  // which is exactly as long as the request still carries them.
  const technologyOptions = useMemo(() => {
    const active = technologies?.data ?? technologies ?? [];
    if (!request) return active;
    const known = new Set(active.map((technology) => technology._id));
    const carried = [];
    for (const requestedPosition of request.requestedPositions ?? []) {
      for (const technology of requestedPosition.technologies ?? []) {
        if (!technology?._id || known.has(technology._id)) continue;
        known.add(technology._id);
        carried.push(technology);
      }
    }
    return carried.length > 0 ? [...active, ...carried] : active;
  }, [technologies, request]);

  const fileRequest = (payload) => {
    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Request filed');
        setDuplicateWarn(null);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error('Could not file request', {
          description: error?.response?.data?.message,
        });
      },
    });
  };

  const saveEdit = (payload) => {
    updateMutation.mutate(
      { id: request.id, data: payload },
      {
        onSuccess: () => {
          toast.success('Request updated');
          setImpactWarn(null);
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Could not update request', {
            description: error?.response?.data?.message,
          });
        },
      }
    );
  };

  const onSubmit = (values) => {
    const payload = toPayload(values);

    if (isEditing) {
      const editPayload = toEditPayload(values);
      const impact = getEditImpact(request, {
        positionIds: values.requestedPositions.map(
          (requestedPosition) => requestedPosition.position
        ),
        projectId: values.projectMode === 'existing' ? values.projectId : null,
      });

      // The one refusal left. Stopped here as well as on the server, because
      // "you can't" is worth saying before the form is submitted, not after.
      if (impact.blocked.length > 0) {
        toast.error('That position is spoken for', {
          description: describePlacedRefusal(impact.blocked),
        });
        return;
      }

      if (impact.closeOutCount > 0 || impact.projectChanged) {
        setImpactWarn({ payload: editPayload, impact });
        return;
      }

      saveEdit(editPayload);
      return;
    }

    // Exactly one of these lands in the payload, matching what the server
    // requires on create — draft mode never sends a stray projectId, and vice
    // versa.
    const createPayload =
      values.projectMode === 'draft'
        ? {
            ...payload,
            draftProject: {
              name: values.draftProject.name.trim(),
              client: values.draftProject.client?.trim() || '',
              description: values.draftProject.description?.trim() || '',
            },
          }
        : { ...payload, projectId: values.projectId };

    // A duplicate only makes sense against a real project — a draft-project
    // filing has no id yet to check open demand against.
    if (values.projectMode === 'existing' && existingOpenRequest) {
      setDuplicateWarn({ payload: createPayload, existing: existingOpenRequest });
      return;
    }

    fileRequest(createPayload);
  };

  const watchedPositions = watch('requestedPositions') ?? [];
  const projectMode = watch('projectMode');
  const watchedDraft = watch('draftProject');

  const usedPositionIds = (index) =>
    watchedPositions
      .map((row, rowIndex) => (rowIndex === index ? null : row?.position))
      .filter(Boolean);

  const switchToDraft = () => {
    setValue('projectMode', 'draft');
    setValue('projectId', '');
    setValue('draftProject', emptyDraftProject);
    setSelectedProject(null);
  };

  const switchToExisting = () => {
    setValue('projectMode', 'existing');
    setValue('draftProject', null);
  };

  // The footer says what's still missing instead of leaving a disabled-looking
  // button unexplained; once the form is fileable it reports the total demand.
  const totalSeats = watchedPositions.reduce((sum, row) => sum + (Number(row?.count) || 0), 0);
  const filledRows = watchedPositions.filter((row) => row?.position).length;
  const footerHint = (() => {
    if (projectMode === 'existing' && !watch('projectId')) {
      return 'Pick a project to continue';
    }
    if (projectMode === 'draft' && !(watch('draftProject.name') || '').trim()) {
      return 'Name the project to continue';
    }
    if (!filledRows) return 'Choose a position to continue';
    return `${totalSeats} ${totalSeats === 1 ? 'seat' : 'seats'} across ${filledRows} ${
      filledRows === 1 ? 'position' : 'positions'
    }`;
  })();

  return (
    <>
      {/* The form steps aside rather than stacking a dialog on a dialog — the
          draft is still there behind it, and "Back to form" returns to it
          untouched. */}
      <Dialog open={open && !duplicateWarn && !impactWarn} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl" data-test="request-form-modal">
          <DialogHeader className="gap-1 border-b border-border/60 px-6 py-5">
            <DialogTitle className="text-2xl font-bold">
              {isEditing ? 'Edit staffing request' : 'New staffing request'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'One row per position. Mentors see the change right away.'
                : 'One row per position. Mentors get it as soon as you file.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-col">
            <div className="flex max-h-[calc(var(--app-vh)*0.65)] flex-col gap-6 overflow-y-auto px-6 py-5">
              {projectMode === 'draft' ? (
                <div
                  className="flex flex-col gap-4 rounded-2xl border border-border/60 p-4"
                  data-test="request-form-draft-project"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Project details
                    </Label>
                    {/* Naming the first real project is resolution, not an
                        edit — the admin's, through ResolveProjectDialog. */}
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={switchToExisting}
                        className="text-sm font-semibold text-primary hover:underline"
                        data-test="request-form-search-existing"
                      >
                        Search existing instead
                      </button>
                    )}
                  </div>

                  <DraftProjectFields control={control} errors={errors} />

                  {!isEditing && (
                    <p
                      className="rounded-xl bg-primary/10 px-3.5 py-2.5 text-sm text-foreground"
                      data-test="request-form-draft-notice"
                    >
                      This files as <strong>Needs project</strong> — an admin will match it to an
                      existing project or create it before anyone can be recommended.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-semibold">Project</Label>
                  <Controller
                    name="projectId"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        {selectedProject ? (
                          <div className="flex h-11 items-center justify-between rounded-xl border border-primary bg-transparent px-3.5 text-sm">
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
                  {errors.projectId && (
                    <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                      {errors.projectId.message}
                    </p>
                  )}
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={switchToDraft}
                      className="self-start text-sm font-semibold text-primary hover:underline"
                      data-test="request-form-describe-instead"
                    >
                      Don&apos;t see it? Describe the project instead
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Pointing this at a different project moves everyone put forward with it. A
                      genuinely different ask is a new request.
                    </p>
                  )}

                  {/* A request resolved out of a draft keeps the details it was
                      filed with — still the record of what was asked for, and
                      still editable, with both versions in the history trail. */}
                  {isEditing && watchedDraft && (
                    <div
                      className="mt-2 flex flex-col gap-4 rounded-2xl border border-border/60 p-4"
                      data-test="request-form-draft-project"
                    >
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        As originally asked for
                      </Label>
                      <DraftProjectFields control={control} errors={errors} />
                    </div>
                  )}
                </div>
              )}

              {/* Column headers instead of a per-row card: the rows read as one
                  table, so what each cell means is said once. */}
              <div className="flex flex-col gap-3">
                {/* px-3 matches the cards' padding below — without it the
                    headers sit a card-padding's width off their columns. */}
                <div
                  className={`${positionGridClass} items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`}
                >
                  <span>Position</span>
                  <span>Seats</span>
                  <span>
                    Technologies <span className="font-normal normal-case">· optional</span>
                  </span>
                  <span />
                </div>

                {fields.map((field, index) => {
                  const lock = lockFor(watchedPositions[index]?.position);
                  return (
                    // Each position is its own shaded card: a row can carry a
                    // chip tray and a lock line under it, so at three positions
                    // the flat list stops reading as one row per ask.
                    <div
                      key={field.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-muted/20 p-3"
                      data-test={`request-form-position-row-${index}`}
                    >
                      <div className={`${positionGridClass} items-start`}>
                        <Controller
                          name={`requestedPositions.${index}.position`}
                          control={control}
                          render={({ field: positionField }) => (
                            <Select
                              onValueChange={positionField.onChange}
                              value={positionField.value}
                              disabled={Boolean(lock)}
                            >
                              <SelectTrigger
                                className={`w-full ${rowControlClass}`}
                                data-test={`request-form-position-select-${index}`}
                              >
                                <SelectValue placeholder="Choose position…" />
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
                        <Controller
                          name={`requestedPositions.${index}.count`}
                          control={control}
                          render={({ field: countField }) => (
                            <SeatStepper
                              value={countField.value}
                              onChange={countField.onChange}
                              index={index}
                            />
                          )}
                        />
                        <Controller
                          name={`requestedPositions.${index}.technologies`}
                          control={control}
                          render={({ field: techField }) => (
                            <TechnologyMultiSelect
                              technologies={technologyOptions}
                              selectedIds={techField.value}
                              onChange={techField.onChange}
                              placeholder="React, TypeScript…"
                              showSelected={false}
                            />
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-8 text-muted-foreground"
                          disabled={fields.length === 1 || Boolean(lock)}
                          onClick={() => remove(index)}
                          aria-label="Remove position"
                          // A disabled control that says nothing reads as broken;
                          // both reasons it can be disabled are worth a sentence.
                          title={
                            lock
                              ? `${lock.name} can't be removed while someone is placed against it`
                              : fields.length === 1
                                ? 'A request needs at least one position'
                                : undefined
                          }
                          data-test={`request-form-position-remove-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {lock && (
                        <div
                          className="flex items-center gap-1.5"
                          data-test={`request-form-position-locked-${index}`}
                        >
                          <span className="rounded-full bg-[hsl(var(--symphony-placed)/0.14)] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--symphony-placed))]">
                            {lock.placed} placed
                          </span>
                          {/* The reason sits behind the icon rather than on the
                              row: it is the same sentence for every locked row,
                              and naming each placed intern made the form louder
                              than the ask it is meant to be showing. */}
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Why ${lock.name} can't be changed`}
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  data-test={`request-form-position-locked-help-${index}`}
                                >
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {lock.placed === 1 ? 'One intern is' : `${lock.placed} interns are`}{' '}
                                already placed against {lock.name}, so the position can&apos;t be
                                changed or removed. The seats and technologies are still yours to
                                change, and a genuinely different ask is a new request.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}

                      {/* The picked chips get the full row width instead of the
                        narrow technologies column, and say what they are — three
                        of them wrapping inside the column read as an overflow. */}
                      <Controller
                        name={`requestedPositions.${index}.technologies`}
                        control={control}
                        render={({ field: techField }) =>
                          (techField.value ?? []).length > 0 ? (
                            <div
                              // Lighter than the card it sits in, not darker —
                              // shade on shade would read as a third nesting level.
                              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/50 bg-background/70 px-3 py-2.5"
                              data-test={`request-form-position-technologies-${index}`}
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Technologies picked
                              </span>
                              <SelectedTechnologyChips
                                technologies={technologyOptions}
                                selectedIds={techField.value}
                                onChange={techField.onChange}
                              />
                            </div>
                          ) : null
                        }
                      />
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => append(emptyPositionRow)}
                  className="flex h-11 items-center gap-2 self-start rounded-xl border border-dashed border-input px-4 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                  data-test="request-form-position-add"
                >
                  <Plus className="h-4 w-4" />
                  Add position
                </button>

                {errors.requestedPositions && (
                  <p className="text-xs text-[hsl(var(--tone-danger-fg))]">
                    {errors.requestedPositions.message ||
                      errors.requestedPositions.root?.message ||
                      'Check the requested positions'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">
                  Needed by{' '}
                  <span className="text-sm font-normal text-muted-foreground">· optional</span>
                </Label>
                <Controller
                  name="neededBy"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="No date given"
                      className="h-11 w-full rounded-xl"
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="items-center gap-3 border-t border-border/60 px-6 py-4 sm:justify-between">
              <p className="text-sm text-muted-foreground" data-test="request-form-hint">
                {footerHint}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending} data-test="request-form-save">
                  {mutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'File request'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DuplicateRequestDialog
        open={Boolean(duplicateWarn)}
        duplicateOf={duplicateWarn?.existing}
        isSaving={createMutation.isPending}
        onCancel={() => setDuplicateWarn(null)}
        onFileAnyway={() => fileRequest(duplicateWarn.payload)}
        onViewExisting={() => {
          const existingId = duplicateWarn?.existing?.id;
          setDuplicateWarn(null);
          onOpenChange(false);
          onViewExisting?.(existingId);
        }}
      />

      <EditImpactDialog
        open={Boolean(impactWarn)}
        impact={impactWarn?.impact}
        projectName={selectedProject?.name ?? 'the new project'}
        isSaving={updateMutation.isPending}
        onCancel={() => setImpactWarn(null)}
        onConfirm={({ notPlacedReason }) => saveEdit({ ...impactWarn.payload, notPlacedReason })}
      />
    </>
  );
}
