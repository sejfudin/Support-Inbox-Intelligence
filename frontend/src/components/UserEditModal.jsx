import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateUser } from "@/queries/auth";
import { toast } from "sonner"; 

const UserEditModal = ({ user, onClose }) => {
  const [editedUser, setEditedUser] = useState({
    user: user.user || "", 
    email: user.email || "", 
    role: user.role || "user", 
    status: user.status || "Active" 
  });

  const updateUserMutation = useUpdateUser();

  const handleSave = (e) => {
    e.preventDefault();

    const payload = {
      fullname: editedUser.user,
      email: editedUser.email,
      role: editedUser.role.toLowerCase(),
      active: editedUser.status === "Active"
    };

    const toastId = toast.loading("Updating user...");

    updateUserMutation.mutate(
      { 
        id: user.id, 
        data: payload 
      },
      {
        onSuccess: () => {
          toast.dismiss(toastId);
          toast.success("User updated successfully");
          onClose(); 
        },
        onError: (err) => {
          toast.dismiss(toastId);
          console.error("Failed to update", err);
          
          const errorMessage = err.response?.data?.message || "Failed to update user.";
          
          toast.error(errorMessage);
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl sm:max-h-[90vh]">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3 sm:items-center">
            <CardTitle className="text-xl">Edit: {user.user}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Full Name
                  </Label>
                  <Input
                    value={editedUser.user}
                    onChange={(e) =>
                      setEditedUser({ ...editedUser, user: e.target.value })
                    }
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={editedUser.email}
                    onChange={(e) =>
                      setEditedUser({ ...editedUser, email: e.target.value })
                    }
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Role
                  </Label>
                  <Select
                    value={editedUser.role}
                    onValueChange={(value) =>
                      setEditedUser({ ...editedUser, role: value })
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Status
                  </Label>
                  <Select
                    value={editedUser.status}
                    onValueChange={(value) =>
                      setEditedUser({ ...editedUser, status: value })
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button type="submit" className="flex-1">
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserEditModal;
