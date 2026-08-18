import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import {
  useCreateInternshipType,
  useInternshipTypes,
  useUpdateInternshipType,
} from '@/queries/internshipTypes';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import {
  ReferenceDataPanel,
  ReferenceDataSlugBadge,
  ReferenceDataTableMessage,
  referenceDataActionClass,
  referenceDataRowActionClass,
} from '@/components/reference-data/ReferenceDataPanel';
import { toast } from 'sonner';

const emptyForm = { name: '', description: '', isActive: true };

export function ReferenceDataInternshipTypesPanel() {
  const { data: types = [], isPending } = useInternshipTypes({ includeInactive: true });
  const createMutation = useCreateInternshipType();
  const updateMutation = useUpdateInternshipType();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (type) => {
    setEditingId(type._id);
    setForm({
      name: type.name,
      description: type.description || '',
      isActive: type.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating type...' : 'Creating type...');

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.dismiss(toastId);
      toast.success(editingId ? 'Internship type updated' : 'Internship type created');
      setDialogOpen(false);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.response?.data?.message || 'Failed to save internship type');
    }
  };

  return (
    <>
      <ReferenceDataPanel
        description="Program tracks such as FEP, Shadow, Industrial, and 1-on-1."
        action={
          <Button
            type="button"
            onClick={openCreate}
            className={referenceDataActionClass}
            data-test="platform-management-internship-types-add-button"
          >
            <Plus className="h-4 w-4" />
            Add type
          </Button>
        }
      >
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[180px]">Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <ReferenceDataTableMessage colSpan={5}>
                Loading internship types…
              </ReferenceDataTableMessage>
            ) : types.length === 0 ? (
              <ReferenceDataTableMessage colSpan={5}>
                No internship types yet.
              </ReferenceDataTableMessage>
            ) : (
              types.map((type) => (
                <TableRow key={type._id}>
                  <TableCell className="font-medium text-foreground">{type.name}</TableCell>
                  <TableCell>
                    <ReferenceDataSlugBadge>{type.slug}</ReferenceDataSlugBadge>
                  </TableCell>
                  <TableCell className="max-w-0 truncate text-muted-foreground">
                    {type.description || '—'}
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={type.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(type)}
                      className={referenceDataRowActionClass}
                      aria-label={`Edit ${type.name}`}
                      data-test={`platform-management-internship-types-edit-button-${type._id}`}
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
        <DialogContent data-test="platform-management-internship-types-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit internship type' : 'Add internship type'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="internship-type-name">Name</Label>
              <Input
                id="internship-type-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                data-test="platform-management-internship-types-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internship-type-description">Description</Label>
              <Textarea
                id="internship-type-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-test="platform-management-internship-types-description-input"
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-border px-4 py-3">
                <Checkbox
                  id="internship-type-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                  data-test="platform-management-internship-types-active-checkbox"
                />
                <Label htmlFor="internship-type-active">Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" data-test="platform-management-internship-types-save-button">
                {editingId ? 'Save changes' : 'Create type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
