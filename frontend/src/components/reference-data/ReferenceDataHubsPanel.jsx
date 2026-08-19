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
  ReferenceDataTableMessage,
  referenceDataActionClass,
  referenceDataRowActionClass,
  ReferenceDataTableLoading,
} from '@/components/reference-data/ReferenceDataPanel';
import { useCreateHub, useHubs, useUpdateHub } from '@/queries/hubs';
import { toast } from 'sonner';

const emptyForm = { name: '', city: '', country: '', isActive: true };

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
    <>
      <ReferenceDataPanel
        loading={isPending}
        loadingLabel="Loading hubs"
        description="Company office locations used to assign every employee to a hub."
        action={
          <Button
            type="button"
            onClick={openCreate}
            className={referenceDataActionClass}
            data-test="platform-management-hubs-add-button"
          >
            <Plus className="h-4 w-4" />
            Add hub
          </Button>
        }
      >
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="w-[180px]">City</TableHead>
              <TableHead className="w-[200px]">Country</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <ReferenceDataTableLoading colSpan={5} />
            ) : hubs.length === 0 ? (
              <ReferenceDataTableMessage colSpan={5}>No hubs yet.</ReferenceDataTableMessage>
            ) : (
              hubs.map((hub) => (
                <TableRow key={hub._id}>
                  <TableCell className="font-medium text-foreground">{hub.name}</TableCell>
                  <TableCell className="text-muted-foreground">{hub.city || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{hub.country || '—'}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={hub.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(hub)}
                      className={referenceDataRowActionClass}
                      aria-label={`Edit ${hub.name}`}
                      data-test={`platform-management-hubs-edit-button-${hub._id}`}
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
        <DialogContent data-test="platform-management-hubs-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit hub' : 'Add hub'}</DialogTitle>
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
              <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-border px-4 py-3">
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
                {editingId ? 'Save changes' : 'Create hub'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
