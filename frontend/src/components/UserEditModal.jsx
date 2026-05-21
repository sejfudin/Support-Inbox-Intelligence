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
import { toast } from 'sonner';

const UserEditModal = ({ user, onClose }) => {
  const [editedUser, setEditedUser] = useState({
    user: user.user || '',
    email: user.email || '',
    role: user.role || 'user',
    active: user.active ?? true,
  });

  const updateUserMutation = useUpdateUser();

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
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Edit User</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="fullname"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Full Name
              </Label>
              <Input
                id="fullname"
                value={editedUser.user}
                onChange={(e) => setEditedUser({ ...editedUser, user: e.target.value })}
                className="h-10"
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editedUser.email}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                className="h-10"
                placeholder="Enter email address"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="role"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
              >
                Role
              </Label>
              <Select
                value={editedUser.role}
                onValueChange={(value) => setEditedUser({ ...editedUser, role: value })}
              >
                <SelectTrigger id="role" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="status"
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
                <SelectTrigger id="status" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-6">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
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
