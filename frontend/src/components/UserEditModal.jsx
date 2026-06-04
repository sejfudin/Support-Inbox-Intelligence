import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateUser } from '@/queries/auth';
import { useRoles } from '@/queries/roles';
import { toast } from 'sonner';

const UserEditModal = ({ user, onClose }) => {
  const [editedUser, setEditedUser] = useState({
    user: user.user || '',
    email: user.email || '',
    role: user.role || '',
    active: user.active ?? true,
  });

  const updateUserMutation = useUpdateUser();
  const { data: roles = [] } = useRoles();

  const handleSave = (e) => {
    e.preventDefault();

    const payload = {
      fullname: editedUser.user,
      email: editedUser.email,
      role: editedUser.role.toLowerCase(),
      active: editedUser.active,
    };

    const toastId = toast.loading('Updating user...');

    updateUserMutation.mutate(
      {
        id: user.id,
        data: payload,
      },
      {
        onSuccess: () => {
          toast.dismiss(toastId);
          toast.success('User updated successfully');
          onClose();
        },
        onError: (err) => {
          toast.dismiss(toastId);

          const errorMessage = err.response?.data?.message || 'Failed to update user.';

          toast.error(errorMessage);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Edit User
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            data-test="user-edit-modal-close-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="user-edit-modal-fullname"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Full Name
              </Label>
              <Input
                id="user-edit-modal-fullname"
                value={editedUser.user}
                onChange={(e) => setEditedUser({ ...editedUser, user: e.target.value })}
                className="h-10"
                placeholder="Enter full name"
                data-test="user-edit-modal-fullname-input"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="user-edit-modal-email"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Email
              </Label>
              <Input
                id="user-edit-modal-email"
                type="email"
                value={editedUser.email}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                className="h-10"
                placeholder="Enter email address"
                data-test="user-edit-modal-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="user-edit-modal-role"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Role
              </Label>
              <Select
                value={editedUser.role}
                onValueChange={(value) => setEditedUser({ ...editedUser, role: value })}
              >
                <SelectTrigger
                  id="user-edit-modal-role"
                  className="h-10"
                  data-test="user-edit-modal-role-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem
                      key={r.slug}
                      value={r.slug}
                      data-test={`user-edit-modal-role-option-${r.slug}`}
                    >
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="user-edit-modal-status"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Status
              </Label>
              <Select
                value={editedUser.active ? 'Active' : 'Inactive'}
                onValueChange={(value) =>
                  setEditedUser({ ...editedUser, active: value === 'Active' })
                }
              >
                <SelectTrigger
                  id="user-edit-modal-status"
                  className="h-10"
                  data-test="user-edit-modal-status-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active" data-test="user-edit-modal-status-option-active">
                    Active
                  </SelectItem>
                  <SelectItem value="Inactive" data-test="user-edit-modal-status-option-inactive">
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                data-test="user-edit-modal-cancel-button"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" data-test="user-edit-modal-save-button">
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;
