import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { AI_TECHNOLOGY_CATEGORY, isAiSkill } from '@/helpers/technologyCategories';
import { toast } from 'sonner';
import { useLoaderHold } from '@/components/ui/loader';

// Which half of the catalog a row belongs to. The interns' page has one search box per
// category, so a row created in the wrong one is a row nobody finds — hence a required
// choice on create rather than a silent default to Technology.
const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Technology' },
  { value: AI_TECHNOLOGY_CATEGORY, label: 'AI skill' },
];

const categoryLabel = (technology) => (isAiSkill(technology) ? 'AI skill' : 'Technology');

// `category` starts unset so create forces a choice — see CATEGORY_OPTIONS. The Select shows
// its placeholder and the submit button stays disabled until one of the two is picked.
const emptyForm = { name: '', category: '', isActive: true };

export function ReferenceDataTechnologiesPanel() {
  const {
    data: technologies = [],
    isPending,
    isError,
  } = useTechnologies({
    includeInactive: true,
  });
  // Gated so the overlay mark and the skeleton rows keep the app's one loading rhythm.
  const showLoader = useLoaderHold(isPending, { release: isError });
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
      // Not `technology.category` directly: rows seeded before the field existed carry none,
      // and an empty value would leave the trigger blank and save `undefined` back.
      category: isAiSkill(technology) ? AI_TECHNOLOGY_CATEGORY : 'general',
      isActive: technology.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.category) return;
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
        loading={showLoader}
        loadingLabel="Loading technologies"
        description="Technologies and AI skills used for intern profiles and readiness tracking."
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
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[240px]">Slug</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showLoader ? (
              <ReferenceDataTableLoading colSpan={5} />
            ) : technologies.length === 0 ? (
              <ReferenceDataTableMessage colSpan={5}>
                No technologies yet.
              </ReferenceDataTableMessage>
            ) : (
              technologies.map((technology) => (
                <TableRow key={technology._id}>
                  <TableCell className="font-medium text-foreground">{technology.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryLabel(technology)}
                  </TableCell>
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
            <div className="space-y-2">
              <Label htmlFor="technology-category">Type</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger
                  id="technology-category"
                  data-test="platform-management-technologies-category-select"
                >
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] leading-[1.45] text-muted-foreground">
                Decides which search box on the intern's page finds it. Everything else — declaring,
                assessment, staffing — is the same for both.
              </p>
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
              <Button
                type="submit"
                disabled={!form.category}
                data-test="platform-management-technologies-save-button"
              >
                {editingId ? 'Save changes' : 'Create technology'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
