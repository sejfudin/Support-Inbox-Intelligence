import { useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TechnologyMultiSelect,
  TechnologyViewChips,
} from '@/components/ui/technology-multi-select';
import { ProjectTypeBadge } from '@/components/projects/ProjectTypeBadge';
import {
  ReferenceDataPanel,
  referenceDataActionClass,
} from '@/components/reference-data/ReferenceDataPanel';
import { CHIP } from '@/helpers/badgeTones';
import { PROJECT_TYPES } from '@/helpers/projects';
import { cn } from '@/lib/utils';
import { useTechnologies } from '@/queries/technologies';
import { useCreateProject, useProjects, useUpdateProject } from '@/queries/projects';
import PanelBodySkeleton from '@/components/Skeletons/PanelBodySkeleton';
import { useLoaderHold } from '@/components/ui/loader';

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    dotClass: 'bg-[hsl(var(--tone-info))]',
    textClass: 'text-[hsl(var(--tone-info-fg))]',
  },
  {
    value: 'on_hold',
    label: 'On hold',
    dotClass: 'bg-[hsl(var(--tone-warning))]',
    textClass: 'text-[hsl(var(--tone-warning-fg))]',
  },
  {
    value: 'completed',
    label: 'Completed',
    dotClass: 'bg-[hsl(var(--tone-success))]',
    textClass: 'text-[hsl(var(--tone-success-fg))]',
  },
];

const statusMeta = (status) =>
  STATUS_OPTIONS.find((option) => option.value === status) || STATUS_OPTIONS[0];

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return (
    <span className={cn(CHIP, 'gap-1.5 bg-muted', meta.textClass)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Selectable segmented status control (project edit form). */
function StatusSegmentedSelect({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {STATUS_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] border px-3 text-[12.5px] font-medium transition-colors',
              selected
                ? 'border-primary/40 bg-primary/10 accent-ink'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            data-test={`project-status-option-${option.value}`}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', option.dotClass)} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Project type picker. A dropdown rather than a segmented control like Status:
 * the type list is expected to grow past what a single row of buttons can hold,
 * and swapping the control later would move the field under the admin twice.
 *
 * Starts empty on create — a pre-selected default is exactly how a project ends
 * up mistyped, so there is no value until the admin picks one.
 */
function ProjectTypeSelect({ id, value, onChange }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} data-test="platform-management-projects-type-select">
        <SelectValue placeholder="Select project type" />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_TYPES.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-test={`platform-management-projects-type-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const emptyForm = {
  name: '',
  description: '',
  client: '',
  type: '',
  status: 'active',
  technologyIds: [],
};

const formFromProject = (project) => ({
  name: project.name || '',
  description: project.description || '',
  client: project.client || '',
  type: project.type || '',
  status: project.status || 'active',
  technologyIds: (project.technologies || []).map((technology) => technology._id),
});

/**
 * Projects are the one tab that isn't a table — a project carries a description
 * and a stack, which a row can only truncate — so it stays a grid. Flattened to
 * the overhaul's surface all the same: 12px radius, one hairline, no lift on
 * hover, and a 36px icon tile rather than the old 48px gradient slab.
 */
function ProjectCard({ project, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full flex-col items-start gap-2.5 rounded-[var(--r-card)] border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/50"
      data-test={`platform-management-projects-card-${project._id}`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-tile)] bg-primary/10 accent-ink">
          <Briefcase className="h-[18px] w-[18px]" />
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <ProjectTypeBadge type={project.type} />
          <StatusBadge status={project.status} />
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-semibold text-foreground">{project.name}</h3>
        {project.client && (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground/75">{project.client}</p>
        )}
      </div>
      {project.description && (
        <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-muted-foreground">
          {project.description}
        </p>
      )}
      {project.technologies?.length > 0 && (
        <TechnologyViewChips technologies={project.technologies} />
      )}
    </button>
  );
}

/** The back link out of a single project, shared by the read-only and edit views. */
function BackToProjects({ onBack }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-7 items-center gap-1.5 rounded-[var(--r-control)] px-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Projects
    </button>
  );
}

function DetailField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="app-crumb">{label}</p>
      {children}
    </div>
  );
}

/** System projects can't be edited, so this is what an admin sees instead. */
function ProjectDetail({ project, onBack }) {
  return (
    <section className="app-card p-[18px]">
      <BackToProjects onBack={onBack} />

      <div className="mb-4 mt-3">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
          {project.name}
        </h2>
        {project.client && (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{project.client}</p>
        )}
      </div>

      <div className="space-y-4 border-t border-separator pt-4">
        <DetailField label="Status">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={project.status} />
            <ProjectTypeBadge type={project.type} />
          </div>
        </DetailField>

        <DetailField label="Description">
          <p className="text-[12.5px] leading-[1.5] text-foreground">
            {project.description || 'No description.'}
          </p>
        </DetailField>

        <DetailField label="Technologies">
          <TechnologyViewChips technologies={project.technologies || []} />
        </DetailField>
      </div>
    </section>
  );
}

function ProjectEditForm({ project, technologies, onCancel, onSave, isSaving }) {
  const [form, setForm] = useState(() => formFromProject(project));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="app-card overflow-hidden">
      {/* The head band is the panel's, so a project you opened reads as the same
          card the grid sat in rather than as a different screen. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-[18px] pb-3 pt-[13px]">
        <BackToProjects onBack={onCancel} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className={referenceDataActionClass}
          >
            Cancel
          </Button>
          {/* Type is required server-side, so block the save rather than send an
              empty value — reachable only on a project predating the field. */}
          <Button
            type="submit"
            disabled={isSaving || !form.type}
            className={referenceDataActionClass}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-[18px]">
        <div className="space-y-2">
          <Label htmlFor="project-edit-name">Title</Label>
          <Input
            id="project-edit-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            data-test="platform-management-projects-edit-name-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-edit-client">Client</Label>
          <Input
            id="project-edit-client"
            value={form.client}
            onChange={(e) => setForm((prev) => ({ ...prev, client: e.target.value }))}
            data-test="platform-management-projects-edit-client-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-edit-type">Project type</Label>
          <ProjectTypeSelect
            id="project-edit-type"
            value={form.type}
            onChange={(type) => setForm((prev) => ({ ...prev, type }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <StatusSegmentedSelect
            value={form.status}
            onChange={(status) => setForm((prev) => ({ ...prev, status }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-edit-description">Description</Label>
          <Textarea
            id="project-edit-description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={4}
            data-test="platform-management-projects-edit-description-input"
          />
        </div>

        <div className="space-y-2">
          <Label>Technologies</Label>
          <TechnologyMultiSelect
            technologies={technologies}
            selectedIds={form.technologyIds}
            onChange={(technologyIds) => setForm((prev) => ({ ...prev, technologyIds }))}
            variant="box"
          />
        </div>
      </div>
    </form>
  );
}

export function ReferenceDataProjectsPanel() {
  const { data: projects = [], isPending, isError } = useProjects({ includeAll: true });
  // Gated so the overlay mark and the skeleton rows keep the app's one loading rhythm.
  const showLoader = useLoaderHold(isPending, { release: isError });
  const { data: technologies = [] } = useTechnologies();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const [view, setView] = useState('list'); // 'list' | 'project'
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  const selectedProject = projects.find((project) => project._id === selectedId) || null;

  // The list endpoint sorts alphabetically (best for the recommendation
  // picker elsewhere), but this grid should surface newest projects first —
  // at the top, filling left-to-right — so a project you just added doesn't
  // land wherever its name happens to fall alphabetically.
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [projects]
  );

  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading('Creating project...');
    try {
      await createMutation.mutateAsync(createForm);
      toast.dismiss(toastId);
      toast.success('Project created');
      setCreateOpen(false);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to create project');
    }
  };

  const handleEditSave = async (form) => {
    const toastId = toast.loading('Saving project...');
    try {
      await updateMutation.mutateAsync({ id: selectedProject._id, data: form });
      toast.dismiss(toastId);
      toast.success('Project updated');
      setView('list');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to update project');
    }
  };

  if (view === 'project' && selectedProject) {
    return selectedProject.isSystem ? (
      <ProjectDetail project={selectedProject} onBack={() => setView('list')} />
    ) : (
      <ProjectEditForm
        project={selectedProject}
        technologies={technologies}
        onCancel={() => setView('list')}
        onSave={handleEditSave}
        isSaving={updateMutation.isPending}
      />
    );
  }

  return (
    <>
      <ReferenceDataPanel
        loading={showLoader}
        loadingLabel="Loading projects"
        description="Every client engagement your workspace is running."
        action={
          <Button
            type="button"
            onClick={openCreate}
            className={referenceDataActionClass}
            data-test="platform-management-projects-add-button"
          >
            <Plus className="h-4 w-4" />
            New project
          </Button>
        }
      >
        {showLoader ? (
          // Not a table on this tab — projects render as rows of cards — so the placeholder is
          // lines of copy rather than table cells. The mark comes from the panel itself.
          <PanelBodySkeleton rows={4} className="px-[18px] pb-6" />
        ) : projects.length === 0 ? (
          <p className="px-[18px] py-10 text-center text-[12.5px] text-muted-foreground">
            No projects yet.
          </p>
        ) : (
          <div className="grid gap-3 p-[18px] sm:grid-cols-2 xl:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onOpen={() => {
                  setSelectedId(project._id);
                  setView('project');
                }}
              />
            ))}
          </div>
        )}
      </ReferenceDataPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-test="platform-management-projects-create-dialog">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Add a client engagement to this workspace.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-create-name">Title</Label>
              <Input
                id="project-create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Northwind billing platform"
                required
                data-test="platform-management-projects-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-create-type">Project type</Label>
              <ProjectTypeSelect
                id="project-create-type"
                value={createForm.type}
                onChange={(type) => setCreateForm((prev) => ({ ...prev, type }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-create-description">Description</Label>
              <Textarea
                id="project-create-description"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What is the client trying to achieve, the scope, and the outcome you're aiming for…"
                rows={4}
                data-test="platform-management-projects-description-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-create-client">Client</Label>
              <Input
                id="project-create-client"
                value={createForm.client}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, client: e.target.value }))}
                placeholder="Client or company name"
                data-test="platform-management-projects-client-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Technologies</Label>
              <TechnologyMultiSelect
                technologies={technologies}
                selectedIds={createForm.technologyIds}
                onChange={(technologyIds) => setCreateForm((prev) => ({ ...prev, technologyIds }))}
                variant="box"
              />
            </div>
            <DialogFooter>
              {/* The type dropdown starts empty on purpose (see ProjectTypeSelect),
                  so the admin can reach here without having picked one. */}
              <Button
                type="submit"
                disabled={!createForm.type}
                data-test="platform-management-projects-save-button"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
