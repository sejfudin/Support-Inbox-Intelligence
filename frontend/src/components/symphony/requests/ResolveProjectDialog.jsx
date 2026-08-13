import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { useTechnologies } from '@/queries/technologies';
import {
  useResolveStaffingRequestProject,
  useResolveStaffingRequestProjectByCreating,
} from '@/queries/staffingRequests';
import { matchProjectsByName } from '@/helpers/projectMatch';

const PROJECT_TYPES = [
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal' },
];

const PROJECT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
];

const emptyDraft = (draftProject) => ({
  name: draftProject?.name ?? '',
  client: draftProject?.client ?? '',
  description: draftProject?.description ?? '',
  // Leadership never classifies a project, and there is no sensible default
  // to seed here either — the admin picks type, status and technologies
  // fresh every time, per ticket 06.
  type: '',
  status: 'active',
  technologyIds: [],
});

/**
 * Resolves a request that names a project which doesn't exist yet. Fuzzy
 * matches against the draft name come first — the most expensive mistake
 * here is a duplicate project — with "create new" behind a second, deliberate
 * step. A slug collision on create comes back as a link offer, not a raw
 * error: the second step keeps whatever the admin typed and surfaces a
 * "link to it instead" button pointed at the actual conflicting project.
 */
export function ResolveProjectDialog({ open, onOpenChange, request }) {
  const [mode, setMode] = useState('pick'); // 'pick' | 'create'
  const [draft, setDraft] = useState(() => emptyDraft(request?.draftProject));
  const [collision, setCollision] = useState(null);

  const { data: projectsData } = useProjects({ includeAll: true });
  const projects = projectsData?.data ?? projectsData ?? [];
  const { data: technologiesData } = useTechnologies();
  const technologies = technologiesData?.data ?? technologiesData ?? [];

  const linkMutation = useResolveStaffingRequestProject();
  const createMutation = useResolveStaffingRequestProjectByCreating();

  useEffect(() => {
    if (!open) return;
    setMode('pick');
    setDraft(emptyDraft(request?.draftProject));
    setCollision(null);
  }, [open, request]);

  const matches = useMemo(
    () => matchProjectsByName(request?.draftProject?.name, projects),
    [request, projects]
  );
  const matchedIds = useMemo(() => new Set(matches.map((m) => m.project._id)), [matches]);

  if (!request) return null;

  const link = (projectId) => {
    linkMutation.mutate(
      { id: request.id, projectId },
      {
        onSuccess: () => {
          toast.success('Project linked');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Could not link the project', {
            description: error?.response?.data?.message,
          });
        },
      }
    );
  };

  const submitCreate = () => {
    if (!draft.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!draft.type) {
      toast.error('Choose a project type');
      return;
    }
    createMutation.mutate(
      {
        id: request.id,
        project: {
          name: draft.name.trim(),
          client: draft.client.trim(),
          description: draft.description.trim(),
          type: draft.type,
          status: draft.status,
          technologyIds: draft.technologyIds,
        },
      },
      {
        onSuccess: () => {
          toast.success('Project created and linked');
          onOpenChange(false);
        },
        onError: (error) => {
          const existingProject = error?.response?.data?.data?.existingProject;
          if (error?.response?.status === 409 && existingProject) {
            setCollision(existingProject);
            return;
          }
          toast.error('Could not create the project', {
            description: error?.response?.data?.message,
          });
        },
      }
    );
  };

  const isSaving = linkMutation.isPending || createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl" data-test="resolve-project-dialog">
        <DialogHeader className="gap-1 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-2xl font-bold">Resolve project</DialogTitle>
          <DialogDescription>
            {request.draftProject?.name
              ? `Leadership asked for “${request.draftProject.name}”. Link it to an existing project or create one.`
              : 'Link this request to an existing project or create one.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          {mode === 'pick' ? (
            <>
              {matches.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Possible matches
                  </Label>
                  {matches.map(({ project }) => (
                    <div
                      key={project._id}
                      className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-2.5"
                      data-test={`resolve-project-match-${project._id}`}
                    >
                      <div className="text-sm">
                        <p className="font-semibold">{project.name}</p>
                        {project.client && (
                          <p className="text-xs text-muted-foreground">{project.client}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => link(project._id)}
                        disabled={isSaving}
                        data-test={`resolve-project-link-${project._id}`}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Or search every project
                </Label>
                <SearchableSelect
                  items={projects.filter((project) => !matchedIds.has(project._id))}
                  getLabel={(project) => project.name}
                  placeholder="Search projects…"
                  onSelect={(project) => link(project._id)}
                  disabled={isSaving}
                  dataTest="resolve-project-search"
                />
              </div>

              <button
                type="button"
                onClick={() => setMode('create')}
                className="flex items-center gap-2 self-start text-sm font-semibold text-primary hover:underline"
                data-test="resolve-project-switch-create"
              >
                <Plus className="h-4 w-4" />
                Don&apos;t see it? Create a new project
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {collision && (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm"
                  data-test="resolve-project-collision"
                >
                  <p>
                    A project with this slug already exists — “{collision.name}”. Link to it
                    instead?
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => link(collision._id)}
                    disabled={isSaving}
                    data-test="resolve-project-collision-link"
                  >
                    Link
                  </Button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                    maxLength={160}
                    className="h-11 w-full rounded-xl border border-input/90 bg-transparent px-3.5 text-sm outline-none focus-visible:border-primary"
                    data-test="resolve-project-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    Client <span className="font-normal text-muted-foreground">· optional</span>
                  </Label>
                  <input
                    value={draft.client}
                    onChange={(event) => setDraft((d) => ({ ...d, client: event.target.value }))}
                    maxLength={160}
                    className="h-11 w-full rounded-xl border border-input/90 bg-transparent px-3.5 text-sm outline-none focus-visible:border-primary"
                    data-test="resolve-project-client"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  Description <span className="font-normal text-muted-foreground">· optional</span>
                </Label>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
                  maxLength={2000}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input/90 bg-transparent px-3.5 py-2.5 text-sm outline-none focus-visible:border-primary"
                  data-test="resolve-project-description"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={draft.type}
                    onValueChange={(value) => setDraft((d) => ({ ...d, type: value }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl" data-test="resolve-project-type">
                      <SelectValue placeholder="Choose type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(value) => setDraft((d) => ({ ...d, status: value }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl" data-test="resolve-project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  Technologies <span className="font-normal text-muted-foreground">· optional</span>
                </Label>
                <TechnologyMultiSelect
                  technologies={technologies}
                  selectedIds={draft.technologyIds}
                  onChange={(ids) => setDraft((d) => ({ ...d, technologyIds: ids }))}
                  placeholder="React, TypeScript…"
                />
              </div>

              <button
                type="button"
                onClick={() => setMode('pick')}
                className="self-start text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline"
                data-test="resolve-project-switch-pick"
              >
                Back to matches
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === 'create' && (
            <Button
              type="button"
              onClick={submitCreate}
              disabled={isSaving}
              data-test="resolve-project-create-submit"
            >
              {createMutation.isPending ? 'Creating…' : 'Create & link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
