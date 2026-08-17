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
} from '@/components/reference-data/ReferenceDataPanel';
import { useCreatePosition, usePositions, useUpdatePosition } from '@/queries/positions';
import { toast } from 'sonner';

const emptyForm = { name: '', isActive: true };

export function ReferenceDataPositionsPanel() {
  const { data: positions = [], isPending } = usePositions({ includeInactive: true });
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (position) => {
    setEditingId(position._id);
    setForm({
      name: position.name,
      isActive: position.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating position...' : 'Creating position...');

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.dismiss(toastId);
      toast.success(editingId ? 'Position updated' : 'Position created');
      setDialogOpen(false);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to save position');
    }
  };

  return (
    <>
      <ReferenceDataPanel
        description="Specializations interns declare and get recommended for — kept separate from Technologies, which are the concrete tools, languages and frameworks they use."
        action={
          <Button
            type="button"
            onClick={openCreate}
            className={referenceDataActionClass}
            data-test="platform-management-positions-add-button"
          >
            <Plus className="h-4 w-4" />
            Add position
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
              <ReferenceDataTableMessage colSpan={4}>Loading positions…</ReferenceDataTableMessage>
            ) : positions.length === 0 ? (
              <ReferenceDataTableMessage colSpan={4}>No positions yet.</ReferenceDataTableMessage>
            ) : (
              positions.map((position) => (
                <TableRow key={position._id}>
                  <TableCell className="font-medium text-foreground">{position.name}</TableCell>
                  <TableCell>
                    <ReferenceDataSlugBadge>{position.slug}</ReferenceDataSlugBadge>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={position.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(position)}
                      className={referenceDataRowActionClass}
                      aria-label={`Edit ${position.name}`}
                      data-test={`platform-management-positions-edit-button-${position._id}`}
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
        <DialogContent data-test="platform-management-positions-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit position' : 'Add position'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="position-name">Name</Label>
              <Input
                id="position-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-test="platform-management-positions-name-input"
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-border px-4 py-3">
                <Checkbox
                  id="position-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                  data-test="platform-management-positions-active-checkbox"
                />
                <Label htmlFor="position-active">Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" data-test="platform-management-positions-save-button">
                {editingId ? 'Save changes' : 'Create position'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
