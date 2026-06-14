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
import { toast } from 'sonner';

const emptyForm = { name: '', description: '', isActive: true };
const tableHeadClass =
  'h-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground';

function SlugBadge({ children }) {
  return (
    <span className="inline-flex rounded-md bg-secondary px-2 py-1 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Program tracks such as FEP, Shadow, Industrial, and 1-on-1.
        </p>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          data-test="platform-management-internship-types-add-button"
        >
          <Plus className="h-4 w-4" />
          Add Type
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead className={tableHeadClass}>Name</TableHead>
              <TableHead className={tableHeadClass}>Slug</TableHead>
              <TableHead className={tableHeadClass}>Description</TableHead>
              <TableHead className={tableHeadClass}>Status</TableHead>
              <TableHead className={`${tableHeadClass} w-[80px]`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading internship types...
                </TableCell>
              </TableRow>
            ) : types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No internship types yet.
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => (
                <TableRow key={type._id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>
                    <SlugBadge>{type.slug}</SlugBadge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{type.description || '—'}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={type.isActive ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(type)}
                      data-test={`platform-management-internship-types-edit-button-${type._id}`}
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
        <DialogContent data-test="platform-management-internship-types-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Internship Type' : 'Add Internship Type'}</DialogTitle>
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
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
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
                {editingId ? 'Save Changes' : 'Create Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
