import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, X, Eye, EyeOff } from "lucide-react";
import { UserStatusBadge } from "@/components/UserStatusBadge";
import { RoleBadge } from "@/components/RoleBadge";
import { useUpdateUser } from "@/queries/auth";
import { useAuth } from "@/context/AuthContext"; 
import { toast } from "sonner";
import TableSkeleton from "@/components/Skeletons/TableSkeleton";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  
  const { user, loading, refetchUser } = useAuth();
  const updateUserMutation = useUpdateUser();

  const [draftProfile, setDraftProfile] = useState({
    fullName: "",
    password: "",
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (isEditing) {
        setIsEditing(false);
        setShowPassword(false);
        setDraftProfile({ fullName: "", password: "" });
        return;
      }

      navigate(-1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditing, navigate]);

  const handleSave = (e) => {
    e.preventDefault();
    const id = user?.id || user?._id;
    const payload = {
      fullname: draftProfile.fullName,
    };

    if (draftProfile.password) {
      payload.password = draftProfile.password;
    }

    updateUserMutation.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          setIsEditing(false);
          setShowPassword(false);
          setDraftProfile({ fullName: "", password: "" });
          refetchUser(); 
          toast.success("Profile updated", {
            description: "Your information has been successfully saved.",
          });
        },
      }
    );
  };

  if (loading) return <TableSkeleton/>;
  if (!user) return <div className="flex h-screen items-center justify-center text-red-500">Error Loading User Profile.</div>;

  const profile = {
    fullName: isEditing ? draftProfile.fullName : user.fullname || "",
    email: user.email || "",
    role: user.role || "User",
    status: user.status || "Active",
    password: isEditing ? draftProfile.password : "",
  };

  const isFullNameValid = profile.fullName.trim().length > 0;
  const isPasswordValid = profile.password.length === 0 || profile.password.length >= 6;
  const isFormValid = isFullNameValid && isPasswordValid;

  return (
   <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md md:max-w-2xl my-auto">
        <Card className="shadow-2xl border-slate-200">
          <CardHeader className="flex flex-row items-start justify-between gap-4 px-6 pb-6 pt-8 md:items-center md:px-12 md:pt-10">
            <div className="space-y-1">
              <CardTitle className="text-2xl md:text-3xl font-extrabold text-gray-900">
                User Profile
              </CardTitle>
              <p className="text-sm font-medium text-slate-500">
                {isEditing ? "Update your details" : "Your account information"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                    setShowPassword(false);
                    setDraftProfile({ fullName: "", password: "" });
                  } else {
                    setIsEditing(true);
                    setDraftProfile({
                      fullName: user.fullname || "",
                      password: "",
                    });
                  }
                }}
                className="hover:bg-slate-100 text-slate-600 font-bold"
                aria-label={isEditing ? "Cancel editing profile" : "Edit profile"}
              >
                {isEditing ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Pencil className="h-5 w-5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="hover:bg-slate-100 text-slate-600 font-bold"
                onClick={() => navigate(-1)}
                aria-label="Close profile"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
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
                      setDraftProfile((current) => ({ ...current, fullName: e.target.value }))
                    }
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Email Address
                  </Label>
                  <Input
                    disabled={true}
                    className={`h-14 text-lg border-slate-300 focus:ring-2 ${!isEditing ? "bg-slate-50 text-slate-500 cursor-not-allowed" : "bg-white text-gray-900"}`}
                    value={profile.email}
                    readOnly
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {isEditing ? "New Password (Optional)" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={isEditing && showPassword ? "text" : "password"}
                      disabled={!isEditing}
                      placeholder={isEditing ? "Leave blank to keep current password" : ""}
                    className={`h-14 text-lg border-slate-300 focus:ring-2 pr-12 ${
                        !isEditing 
                          ? "bg-slate-50 text-slate-500 cursor-not-allowed" 
                          : "bg-white text-gray-900"
                      }`}
                      value={isEditing ? profile.password : "********"} 
                      onChange={(e) =>
                        setDraftProfile((current) => ({ ...current, password: e.target.value }))
                      }
                    />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    )}
                  </div>
                  
                  {isEditing && !isPasswordValid && (
                    <p className="text-xs text-red-500 font-medium mt-1">
                      Password must be at least 6 characters long.
                    </p>
                  )}
                </div>

                {/* Badge */}
                {!isEditing && (
                  <div className="grid grid-cols-1 gap-4 pt-4 animate-in fade-in duration-500 sm:grid-cols-2 md:col-span-2">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        User Role
                      </span>
                     <RoleBadge role={profile.role} />
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Account Status
                      </span>
                      <UserStatusBadge status={profile.status} />
                    </div>
                  </div>
                )}
                {isEditing && updateUserMutation.isError && (
                  <div className="md:col-span-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium animate-in fade-in zoom-in duration-300">
                    {updateUserMutation.error?.response?.data?.message || "Something went wrong. Please try again."}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={updateUserMutation.isPending || !isFormValid}
                    className="h-14 flex-1 text-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all transform active:scale-[0.98] shadow-xl flex items-center justify-center gap-2"
                  >
                    {updateUserMutation.isPending ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex-1"
                    onClick={() => {
                      setIsEditing(false);
                      setShowPassword(false);
                      setDraftProfile({ fullName: "", password: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
