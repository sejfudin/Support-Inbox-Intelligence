import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { TechnologyMultiSelect } from '@/components/ui/technology-multi-select';
import { PROJECT_TYPES } from '@/helpers/projects';
import { useTechnologies } from '@/queries/technologies';
import { useCreateProject } from '@/queries/projects';

/**
 * Creating a project, from wherever.
 *
 * Extracted out of `ReferenceDataProjectsPanel` when the dashboard's "Add
 * project" quick action needed the same form — one dialog with one mutation,
 * rather than the second copy of a create form this repo already regrets once
 * (`NewRecommendationDialog`; see `.scratch/admin-dashboard/build-notes.md`).
 * Platform Management renders this too, so a field added here appears in both
 * places.
 *
 * `POST /api/projects` is `requireRole(ADMIN)`. Worth knowing: `/projects` and
 * `/projects/:id` are mounted **leadership-only** in `AppRoutes.jsx`, so an admin
 * has the create endpoint and no project pages of their own — Platform Management
 * and this dialog are the whole surface.
 */

const emptyForm = {
  name: '',
  description: '',
  client: '',
  type: '',
  status: 'active',
  technologyIds: [],
};

export function NewProjectDialog({ open, onClose, idPrefix = 'project-create', dataTestPrefix }) {
  const { data: technologies = [] } = useTechnologies();
  const createMutation = useCreateProject();
  const [form, setForm] = useState(emptyForm);

  // Reset per open, so a half-typed project that was cancelled does not come back
  // the next time the dialog is raised.
  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  const test = (suffix) => (dataTestPrefix ? `${dataTestPrefix}-${suffix}` : undefined);
  const patch = (fields) => setForm((prev) => ({ ...prev, ...fields }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading('Creating project...');
    try {
      await createMutation.mutateAsync(form);
      toast.dismiss(toastId);
      toast.success('Project created');
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to create project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-test={test('dialog')}>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Add a client engagement to this workspace.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>Title</Label>
            <Input
              id={`${idPrefix}-name`}
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="e.g. Northwind billing platform"
              required
              data-test={test('name-input')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-type`}>Project type</Label>
            {/* Starts empty on purpose: the model requires a type with no default,
                so the admin classifies every project explicitly rather than
                inheriting whichever value happened to be first. */}
            <Select value={form.type || undefined} onValueChange={(type) => patch({ type })}>
              <SelectTrigger id={`${idPrefix}-type`} data-test={test('type-select')}>
                <SelectValue placeholder="Select project type" />
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

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-description`}>Description</Label>
            <Textarea
              id={`${idPrefix}-description`}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="What is the client trying to achieve, the scope, and the outcome you're aiming for…"
              rows={4}
              data-test={test('description-input')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-client`}>Client</Label>
            <Input
              id={`${idPrefix}-client`}
              value={form.client}
              onChange={(event) => patch({ client: event.target.value })}
              placeholder="Client or company name"
              data-test={test('client-input')}
            />
          </div>

          <div className="space-y-2">
            <Label>Technologies</Label>
            <TechnologyMultiSelect
              technologies={technologies}
              selectedIds={form.technologyIds}
              onChange={(technologyIds) => patch({ technologyIds })}
              variant="box"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.type || createMutation.isPending}
              data-test={test('save-button')}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {createMutation.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
