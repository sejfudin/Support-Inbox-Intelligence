import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllWorkspaces } from "@/queries/workspaces";
import { useRegisterUser } from "@/queries/auth";
import { toast } from "sonner";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const Register = () => {
  const navigate = useNavigate();
  const [errorString, setErrorString] = useState("");
  const [createdUser, setCreatedUser] = useState(null);
  const { mutate, isPending } = useRegisterUser();
  const { data: workspaces = [], isLoading: loadingWorkspaces } = useAllWorkspaces();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      role: "user",
      workspaceId: "none",
      workspaceRole: "member",
    },
  });
  const selectedRole = watch("role");
  const selectedWorkspaceId = watch("workspaceId");
  const isGlobalAdmin = selectedRole === "admin";
  const hasSelectedWorkspace = !isGlobalAdmin && selectedWorkspaceId && selectedWorkspaceId !== "none";

  useEffect(() => {
    if (isGlobalAdmin) {
      setValue("workspaceId", "none");
      setValue("workspaceRole", "member");
    }
  }, [isGlobalAdmin, setValue]);

  useEffect(() => {
    if (!hasSelectedWorkspace) {
      setValue("workspaceRole", "member");
    }
  }, [hasSelectedWorkspace, setValue]);

  const onSubmit = (data) => {
    setErrorString("");
    setCreatedUser(null);
    const loadingToast = toast.loading("Creating user account...");
    const payload = {
      ...data,
      workspaceId:
        data.role === "admin" || data.workspaceId === "none"
          ? undefined
          : data.workspaceId,
      workspaceRole:
        data.role === "admin" || data.workspaceId === "none"
          ? undefined
          : data.workspaceRole,
    };

    mutate(payload, {
      onSuccess: async (result) => {
        toast.dismiss(loadingToast); 

        if (result?.requiresPasswordSetup) {
          setCreatedUser({
            fullName: data.fullName,
            email: data.email,
            role: data.role,
            workspaceId: payload.workspaceId,
          });
          toast.success("User created successfully", {
            description: `${data.fullName} can now open TaskManager and set a password using their email.`,
          });
          reset({
            fullName: "",
            email: "",
            role: "user",
            workspaceId: "none",
            workspaceRole: "member",
          });
        } else {
          toast.success("User registered successfully", {
            description: `Account for ${data.fullName} has been created.`,
          });
          navigate("/admin/users");
        }
      },
      onError: (err) => {
        toast.dismiss(loadingToast);
        
        const message = err?.response?.data?.message || "Registration failed";
        setErrorString(message);
        
        toast.error("Error", {
          description: message,
        });
      },
    });
  };

  const copyShareMessage = async () => {
    if (!createdUser?.email) return;
    const message = `Hi ${createdUser.fullName}, your TaskManager account is ready. Open the app, choose "Set password", and enter this email address to activate your account: ${createdUser.email}`;
    await navigator.clipboard.writeText(message);
    toast.success("Invite message copied");
  };

  if (createdUser) {
    return (
      <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-6 sm:py-10">
          <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-primary/10 bg-slate-950 text-white shadow-[0_32px_80px_-40px_rgba(35,39,92,0.95)]">
              <CardHeader className="space-y-5">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Account Created
                </div>
                <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                  <span className="text-white">Task</span>
                  <span className="text-blue-300">Manager</span>
                </div>
                <div>
                  <CardTitle className="text-3xl leading-tight text-white md:text-4xl">
                    The user still needs to create a password
                  </CardTitle>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                    The account is ready, but the user still needs to activate it. They can open
                    TaskManager, choose <span className="font-semibold text-white">Set password</span>,
                    and continue using their internal email address.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">What happens next</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">1</div>
                      Tell the user to open TaskManager
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">2</div>
                      They choose Set password and enter their email
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">3</div>
                      They can then log in and use the app
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
              <CardHeader className="space-y-4 border-b border-slate-100 pb-6">
                <CardTitle className="text-2xl font-bold text-slate-900 md:text-3xl">
                  Share Activation Instructions
                </CardTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      User
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{createdUser.fullName}</p>
                    <p className="mt-1 text-sm text-slate-600">{createdUser.email}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Access
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 capitalize">{createdUser.role}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {createdUser.role === "admin"
                        ? "Global workspace oversight"
                        : createdUser.workspaceId
                          ? "Workspace invitation included"
                          : "No workspace assigned yet"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-6 md:p-8">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">Next step for the user</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ask the user to go to the app login area and select <span className="font-medium text-slate-900">Set password</span>.
                    They should use the email address below to find their invited account and create
                    their password.
                  </p>

                  <div className="mt-4 rounded-2xl border border-white bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Email to use
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{createdUser.email}</p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button type="button" onClick={copyShareMessage} className="flex-1 gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Copy Invite Message
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreatedUser(null)}>
                    Create Another User
                  </Button>
                </div>

                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-slate-900">Why no password was created yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    The password is intentionally created by the user, not by the admin. In this
                    internal flow, the user identifies the invited account with their email and then
                    creates their own password.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" className="flex-1" onClick={() => navigate("/admin/users")}>
                    Back to All Users
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-primary/10 bg-slate-950 text-white shadow-[0_32px_80px_-40px_rgba(35,39,92,0.95)]">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                <UserPlus className="h-3.5 w-3.5" />
                Admin Action
              </div>
              <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                <span className="text-white">Task</span>
                <span className="text-blue-300">Manager</span>
              </div>
              <div>
                <CardTitle className="text-3xl leading-tight text-white md:text-4xl">
                  Create a user and define how they enter the platform
                </CardTitle>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Global admins oversee every workspace. Regular users can be created with optional
                  workspace access so they land in the right place from the start.
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Role logic</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">Admin</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        Gets platform-wide access to all workspaces, user management, and workspace creation.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Users className="mt-0.5 h-5 w-5 text-blue-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">User</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        Can optionally receive a workspace invitation and workspace role during creation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-blue-300" />
                  <div>
                    <p className="text-sm font-semibold text-white">Password creation flow</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      New invited users create their own password from inside the app using their
                      internal email address after the account is created.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
            <CardHeader className="space-y-3 border-b border-slate-100 pb-6">
              <CardTitle className="text-2xl font-bold text-slate-900 md:text-3xl">
                Create User Account
              </CardTitle>
            </CardHeader>

            <CardContent className="px-6 pb-12 pt-6 md:px-12">
            {errorString && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                {errorString}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Full Name
                </label>
                <Input
                  {...register("fullName", {
                    required: "Full name is required",
                    maxLength: { value: 50, message: "Max 50 characters" },
                  })}
                  placeholder="John Doe"
                  className={`h-12 ${errors.fullName ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Email Address
                </label>
                <Input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: EMAIL_REGEX,
                      message: "Invalid email format",
                    },
                  })}
                  placeholder="user@company.com"
                  className={`h-12 ${errors.email ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Global Role
                </label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-900">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {isGlobalAdmin
                    ? "Platform-wide admin access. No workspace assignment needed."
                    : "Regular users can optionally be assigned to a workspace below."}
                </p>
              </div>

              {isGlobalAdmin ? (
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-slate-900">Global admin access</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Admins automatically get platform-wide visibility across all workspaces and can
                    create workspaces, review them, and add users where needed. No workspace role is
                    required at account creation.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Workspace
                    </label>
                    <Controller
                      name="workspaceId"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-900">
                            <SelectValue placeholder="Choose a workspace" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="none">No workspace yet</SelectItem>
                            {workspaces.map((workspace) => (
                              <SelectItem key={workspace._id} value={workspace._id}>
                                {workspace.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      {loadingWorkspaces
                        ? "Loading workspaces..."
                        : "Optional: create a pending workspace invitation immediately."}
                    </p>
                  </div>

                  {hasSelectedWorkspace && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Workspace Role
                      </label>
                      <Controller
                        name="workspaceRole"
                        control={control}
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-900">
                              <SelectValue placeholder="Select workspace role" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                </>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="mt-4 h-12 w-full text-lg font-bold"
              >
                {isPending ? "Creating..." : "Create User"}
              </Button>

              <div className="text-center pt-2 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => navigate("/admin/users")}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Cancel and return
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default Register;
