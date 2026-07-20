import { useState } from 'react';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
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
  TechnologyMultiSelect,
  TechnologyViewChips,
} from '@/components/ui/technology-multi-select';
import { cn } from '@/lib/utils';
import { useTechnologies } from '@/queries/technologies';
import { useCreateProject, useProjects, useUpdateProject } from '@/queries/projects';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', dotClass: 'bg-blue-500', textClass: 'text-blue-600' },
  { value: 'on_hold', label: 'On hold', dotClass: 'bg-amber-500', textClass: 'text-amber-600' },
  {
    value: 'completed',
    label: 'Completed',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
  },
];

const statusMeta = (status) =>
  STATUS_OPTIONS.find((option) => option.value === status) || STATUS_OPTIONS[0];

function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold',
        meta.textClass
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Read-only segmented status display (project detail view — not selectable there). */
function StatusPillsReadOnly({ status }) {
  return (
    <div className="flex gap-2">
      {STATUS_OPTIONS.map((option) => (
        <span
          key={option.value}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium',
            option.value === status
              ? 'border-primary text-primary'
              : 'border-border text-muted-foreground'
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', option.dotClass)} aria-hidden="true" />
          {option.label}
        </span>
      ))}
    </div>
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
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              selected
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-border/80'
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

const emptyForm = { name: '', description: '', client: '', status: 'active', technologyIds: [] };

const formFromProject = (project) => ({
  name: project.name || '',
  description: project.description || '',
  client: project.client || '',
  status: project.status || 'active',
  technologyIds: (project.technologies || []).map((technology) => technology._id),
});

function ProjectCard({ project, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-card p-5 text-left transition hover:border-border hover:shadow-sm"
      data-test={`platform-management-projects-card-${project._id}`}
    >
      <StatusBadge status={project.status} />
      <div>
        <h3 className="font-semibold text-foreground">{project.name}</h3>
        {project.client && <p className="text-sm text-muted-foreground">{project.client}</p>}
      </div>
      {project.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      )}
      {project.technologies?.length > 0 && (
        <TechnologyViewChips technologies={project.technologies} />
      )}
    </button>
  );
}

function ProjectDetail({ project, onBack, onEdit }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </button>
        {!project.isSystem && (
          <Button type="button" variant="outline" onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit project
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
        {project.client && <p className="text-muted-foreground">{project.client}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Status
        </p>
        <StatusPillsReadOnly status={project.status} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Description
        </p>
        <p className="text-sm text-foreground">{project.description || 'No description.'}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Technologies
        </p>
        <TechnologyViewChips technologies={project.technologies || []} />
      </div>
    </div>
  );
}

function ProjectEditForm({ project, technologies, onCancel, onSave, isSaving }) {
  const [form, setForm] = useState(() => formFromProject(project));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

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
    </form>
  );
}

export function ReferenceDataProjectsPanel() {
  const { data: projects = [], isPending } = useProjects({ includeAll: true });
  const { data: technologies = [] } = useTechnologies();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const [view, setView] = useState('list'); // 'list' | 'detail' | 'edit'
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  const selectedProject = projects.find((project) => project._id === selectedId) || null;

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
      setView('detail');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to update project');
    }
  };

  if (view === 'detail' && selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setView('list')}
        onEdit={() => setView('edit')}
      />
    );
  }

  if (view === 'edit' && selectedProject) {
    return (
      <ProjectEditForm
        project={selectedProject}
        technologies={technologies}
        onCancel={() => setView('detail')}
        onSave={handleEditSave}
        isSaving={updateMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every client engagement your workspace is running.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          data-test="platform-management-projects-add-button"
        >
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      {isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onOpen={() => {
                setSelectedId(project._id);
                setView('detail');
              }}
            />
          ))}
        </div>
      )}

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
              <Button type="submit" data-test="platform-management-projects-save-button">
                <Plus className="mr-1.5 h-4 w-4" />
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
