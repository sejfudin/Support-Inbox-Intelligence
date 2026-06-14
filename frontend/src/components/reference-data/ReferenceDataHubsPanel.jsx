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
import { useCreateHub, useHubs, useUpdateHub } from '@/queries/hubs';
import { toast } from 'sonner';

const emptyForm = { name: '', city: '', country: '', isActive: true };
const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';

export function ReferenceDataHubsPanel() {
  const { data: hubs = [], isPending } = useHubs({ includeInactive: true });
  const createMutation = useCreateHub();
  const updateMutation = useUpdateHub();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (hub) => {
    setEditingId(hub._id);
    setForm({
      name: hub.name,
      city: hub.city || '',
      country: hub.country || '',
      isActive: hub.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating hub...' : 'Creating hub...');

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.dismiss(toastId);
      toast.success(editingId ? 'Hub updated' : 'Hub created');
      setDialogOpen(false);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to save hub');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Company office locations used to assign every employee to a hub.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          data-test="platform-management-hubs-add-button"
        >
          <Plus className="h-4 w-4" />
          Add Hub
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead className={tableHeadClass}>Name</TableHead>
              <TableHead className={tableHeadClass}>City</TableHead>
              <TableHead className={tableHeadClass}>Country</TableHead>
              <TableHead className={tableHeadClass}>Status</TableHead>
              <TableHead className={`${tableHeadClass} w-[80px]`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading hubs...
                </TableCell>
              </TableRow>
            ) : hubs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No hubs yet.
                </TableCell>
              </TableRow>
            ) : (
              hubs.map((hub) => (
                <TableRow key={hub._id}>
                  <TableCell className="font-medium">{hub.name}</TableCell>
                  <TableCell>{hub.city || '—'}</TableCell>
                  <TableCell>{hub.country || '—'}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={hub.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(hub)}
                      data-test={`platform-management-hubs-edit-button-${hub._id}`}
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
        <DialogContent data-test="platform-management-hubs-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Hub' : 'Add Hub'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hub-name">Name</Label>
              <Input
                id="hub-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-test="platform-management-hubs-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-city">City</Label>
              <Input
                id="hub-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                data-test="platform-management-hubs-city-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hub-country">Country</Label>
              <Input
                id="hub-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                data-test="platform-management-hubs-country-input"
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                <Checkbox
                  id="hub-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                  data-test="platform-management-hubs-active-checkbox"
                />
                <Label htmlFor="hub-active">Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" data-test="platform-management-hubs-save-button">
                {editingId ? 'Save Changes' : 'Create Hub'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
