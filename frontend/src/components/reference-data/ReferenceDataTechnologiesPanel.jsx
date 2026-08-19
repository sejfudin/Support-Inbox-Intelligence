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
import { UserStatusBadge } from '@/components/UserStatusBadge';
import {
  ReferenceDataPanel,
  ReferenceDataSlugBadge,
  ReferenceDataTableMessage,
  referenceDataActionClass,
  referenceDataRowActionClass,
  ReferenceDataTableLoading,
} from '@/components/reference-data/ReferenceDataPanel';
import { useCreateTechnology, useTechnologies, useUpdateTechnology } from '@/queries/technologies';
import { toast } from 'sonner';

const emptyForm = { name: '', isActive: true };

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
    <>
      <ReferenceDataPanel
        loading={isPending}
        loadingLabel="Loading technologies"
        description="Skills and stacks used for intern profiles and readiness tracking."
        action={
          <Button
            type="button"
            onClick={openCreate}
            className={referenceDataActionClass}
            data-test="platform-management-technologies-add-button"
          >
            <Plus className="h-4 w-4" />
            Add technology
          </Button>
        }
      >
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="w-[240px]">Slug</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <ReferenceDataTableLoading colSpan={4} />
            ) : technologies.length === 0 ? (
              <ReferenceDataTableMessage colSpan={4}>
                No technologies yet.
              </ReferenceDataTableMessage>
            ) : (
              technologies.map((technology) => (
                <TableRow key={technology._id}>
                  <TableCell className="font-medium text-foreground">{technology.name}</TableCell>
                  <TableCell>
                    <ReferenceDataSlugBadge>{technology.slug}</ReferenceDataSlugBadge>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={technology.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(technology)}
                      className={referenceDataRowActionClass}
                      aria-label={`Edit ${technology.name}`}
                      data-test={`platform-management-technologies-edit-button-${technology._id}`}
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ReferenceDataPanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-test="platform-management-technologies-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit technology' : 'Add technology'}</DialogTitle>
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
              <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-border px-4 py-3">
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
                {editingId ? 'Save changes' : 'Create technology'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
