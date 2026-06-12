import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCreateTechnology, useTechnologies, useUpdateTechnology } from '@/queries/technologies';
import { toast } from 'sonner';

const emptyForm = { name: '', isActive: true };
const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';

export function ReferenceDataTechnologiesPanel() {
  const { data: technologies = [], isPending } = useTechnologies({ includeInactive: true });
  const createMutation = useCreateTechnology();
  const updateMutation = useUpdateTechnology();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (technology) => {
    setEditingId(technology._id);
    setForm({
      name: technology.name,
      isActive: technology.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating technology...' : 'Creating technology...');

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.dismiss(toastId);
      toast.success(editingId ? 'Technology updated' : 'Technology created');
      setDialogOpen(false);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to save technology');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Skills and stacks used for intern profiles and readiness tracking.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          data-test="platform-management-technologies-add-button"
        >
          <Plus className="h-4 w-4" />
          Add Technology
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead className={tableHeadClass}>Name</TableHead>
              <TableHead className={tableHeadClass}>Slug</TableHead>
              <TableHead className={tableHeadClass}>Status</TableHead>
              <TableHead className={`${tableHeadClass} w-[80px]`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Loading technologies...
                </TableCell>
              </TableRow>
            ) : technologies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No technologies yet.
                </TableCell>
              </TableRow>
            ) : (
              technologies.map((technology) => (
                <TableRow key={technology._id}>
                  <TableCell className="font-medium">{technology.name}</TableCell>
                  <TableCell>{technology.slug}</TableCell>
                  <TableCell>{technology.isActive ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(technology)}
                      data-test={`platform-management-technologies-edit-button-${technology._id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-test="platform-management-technologies-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Technology' : 'Add Technology'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="technology-name">Name</Label>
              <Input
                id="technology-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-test="platform-management-technologies-name-input"
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                <Checkbox
                  id="technology-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                  data-test="platform-management-technologies-active-checkbox"
                />
                <Label htmlFor="technology-active">Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" data-test="platform-management-technologies-save-button">
                {editingId ? 'Save Changes' : 'Create Technology'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
