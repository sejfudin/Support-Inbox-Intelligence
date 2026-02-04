import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, X, Eye, EyeOff } from "lucide-react";

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [profile, setProfile] = useState({
    fullName: "John Doe",
    email: "john.doe@example.com",
    role: "Admin",
    status: "Active",
    password: "",
  });

  const handleSave = (e) => {
    e.preventDefault();
    setIsEditing(false);

    console.log("Saving...", profile);
  };

  const getStatusBadge = (status) => {
    const s = status.toLowerCase();
    const style =
      s === "active"
        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

    return (
      <Badge
        className={`${style} hover:${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}
      >
        {status}
      </Badge>
    );
  };

  const getRoleBadge = (role) => {
    const r = role.toLowerCase();
    let style = "bg-slate-100 text-slate-700 border-slate-200";
    if (r === "admin")
      style = "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (r === "user") style = "bg-amber-100 text-amber-700 border-amber-200";

    return (
      <Badge
        className={`${style} hover:${style} px-4 py-1 text-xs font-bold uppercase tracking-wider`}
      >
        {role}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-white flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md md:max-w-2xl my-auto">
        <Card className="shadow-2xl border-slate-200">
          <CardHeader className="pt-10 pb-6 px-6 md:px-12 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl md:text-3xl font-extrabold text-gray-900">
                User Profile
              </CardTitle>
              <p className="text-sm font-medium text-slate-500">
                {isEditing ? "Update your details" : "Your account information"}
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setIsEditing(!isEditing);
                setProfile((prev) => ({ ...prev, password: "" }));
              }}
              className="hover:bg-slate-100 text-slate-600 font-bold"
            >
              {isEditing ? (
                <X className="h-6 w-6" />
              ) : (
                <Pencil className="h-5 w-5" />
              )}
            </Button>
          </CardHeader>

          <CardContent className="px-6 md:px-12 pb-12">
            <form className="space-y-6" onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Full Name
                  </Label>
                  <Input
                    disabled={!isEditing}
                    className={`h-14 text-lg border-slate-300 focus:ring-2 ${!isEditing ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white text-gray-900"}`}
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Email Address
                  </Label>
                  <Input
                    disabled={!isEditing}
                    className={`h-14 text-lg border-slate-300 focus:ring-2 ${!isEditing ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white text-gray-900"}`}
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>

                {/* Password Field */}
                {isEditing && (
                  <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      New Password (Optional)
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Leave blank to keep current password"
                        className="h-14 text-lg border-slate-300 focus:ring-2 pr-12"
                        value={profile.password}
                        onChange={(e) =>
                          setProfile({ ...profile, password: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Badge */}
                {!isEditing && (
                  <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-4 animate-in fade-in duration-500">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        User Role
                      </span>
                      {getRoleBadge(profile.role)}
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Account Status
                      </span>
                      {getStatusBadge(profile.status)}
                    </div>
                  </div>
                )}
              </div>

              {isEditing && (
                <Button
                  type="submit"
                  className="w-full h-14 text-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all transform active:scale-[0.98] mt-4 shadow-xl"
                >
                  Save Changes
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
