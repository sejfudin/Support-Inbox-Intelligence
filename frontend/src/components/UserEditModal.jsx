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

    updateUserMutation.mutate(
      { 
        id: user.id, 
        data: payload 
      },
      {
        onSuccess: () => {
          onClose(); 
        },
        onError: (err) => {
          console.error("Failed to update", err);
          alert("Failed to update user.");
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Edit : {user.user}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
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

                {/* Email */}
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

                {/* Role */}
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

                {/* Status */}
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
              <div className="flex gap-3 pt-4">
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
