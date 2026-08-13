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
import { useCreatePosition, usePositions, useUpdatePosition } from '@/queries/positions';
import { toast } from 'sonner';

const emptyForm = { name: '', isActive: true };
const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';

function SlugBadge({ children }) {
  return (
    <span className="inline-flex rounded-md bg-secondary px-2 py-1 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Specializations interns declare and get recommended for — kept separate from Technologies,
          which are the concrete tools/languages/frameworks they use.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          data-test="platform-management-positions-add-button"
        >
          <Plus className="h-4 w-4" />
          Add Position
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
                  Loading positions...
                </TableCell>
              </TableRow>
            ) : positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No positions yet.
                </TableCell>
              </TableRow>
            ) : (
              positions.map((position) => (
                <TableRow key={position._id}>
                  <TableCell className="font-medium">{position.name}</TableCell>
                  <TableCell>
                    <SlugBadge>{position.slug}</SlugBadge>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={position.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(position)}
                      data-test={`platform-management-positions-edit-button-${position._id}`}
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
        <DialogContent data-test="platform-management-positions-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Position' : 'Add Position'}</DialogTitle>
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
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
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
                {editingId ? 'Save Changes' : 'Create Position'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
