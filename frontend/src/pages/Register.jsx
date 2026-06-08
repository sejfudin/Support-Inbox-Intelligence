import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllWorkspaces } from '@/queries/workspaces';
import { useRegisterUser } from '@/queries/auth';
import { useHubs } from '@/queries/hubs';
import { ROLES, ROLE_OPTIONS } from '@/helpers/roles';
import { toast } from 'sonner';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const Register = () => {
  const navigate = useNavigate();
  const [errorString, setErrorString] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const { mutate, isPending } = useRegisterUser();
  const { data: workspaces = [], isLoading: loadingWorkspaces } = useAllWorkspaces();
  const { data: hubs = [] } = useHubs();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      role: '',
      hubId: '',
      workspaceId: 'none',
      workspaceRole: 'member',
    },
  });
  const selectedRole = watch('role');
  const selectedWorkspaceId = watch('workspaceId');
  const isGlobalAdmin = selectedRole === ROLES.ADMIN;
  const hasSelectedWorkspace =
    !isGlobalAdmin && selectedWorkspaceId && selectedWorkspaceId !== 'none';

  useEffect(() => {
    if (isGlobalAdmin) {
      setValue('workspaceId', 'none');
      setValue('workspaceRole', 'member');
    }
  }, [isGlobalAdmin, setValue]);

  useEffect(() => {
    if (!hasSelectedWorkspace) {
      setValue('workspaceRole', 'member');
    }
  }, [hasSelectedWorkspace, setValue]);

  const onSubmit = (data) => {
    setErrorString('');
    setCreatedUser(null);
    const loadingToast = toast.loading('Creating user account...');
    const payload = {
      ...data,
      workspaceId:
        data.role === ROLES.ADMIN || data.workspaceId === 'none' ? undefined : data.workspaceId,
      workspaceRole:
        data.role === ROLES.ADMIN || data.workspaceId === 'none' ? undefined : data.workspaceRole,
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
          toast.success('User created successfully', {
            description: `${data.fullName} can now open TaskManager and set a password using their email.`,
          });
          reset({
            fullName: '',
            email: '',
            role: '',
            hubId: '',
            workspaceId: 'none',
            workspaceRole: 'member',
          });
        } else {
          toast.success('User registered successfully', {
            description: `Account for ${data.fullName} has been created.`,
          });
          navigate('/admin/users');
        }
      },
      onError: (err) => {
        toast.dismiss(loadingToast);

        const message = err?.response?.data?.message || 'Registration failed';
        setErrorString(message);

        toast.error('Error', {
          description: message,
        });
      },
    });
  };

  const copyShareMessage = async () => {
    if (!createdUser?.email) return;
    const message = `Hi ${createdUser.fullName}, your TaskManager account is ready. Open the app, choose "Set password", and enter this email address to activate your account: ${createdUser.email}`;
    await navigator.clipboard.writeText(message);
    toast.success('Invite message copied');
  };

  if (createdUser) {
    return (
      <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-6 sm:py-10">
          <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-primary/10 bg-foreground text-background shadow-elevated">
              <CardHeader className="space-y-5">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-background/80">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Account Created
                </div>
                <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                  <span className="text-background">Task</span>
                  <span className="text-blue-300">Manager</span>
                </div>
                <div>
                  <CardTitle className="text-3xl leading-tight text-background md:text-4xl">
                    The user still needs to create a password
                  </CardTitle>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    The account is ready, but the user still needs to activate it. They can open
                    TaskManager, choose{' '}
                    <span className="font-semibold text-background">Set password</span>, and
                    continue using their internal email address.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                  <p className="text-sm font-semibold text-background">What happens next</p>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/10">
                        1
                      </div>
                      Tell the user to open TaskManager
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/10">
                        2
                      </div>
                      They choose Set password and enter their email
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/10">
                        3
                      </div>
                      They can then log in and use the app
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card shadow-elevated">
              <CardHeader className="space-y-4 border-b border-border/60 pb-6">
                <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
                  Share Activation Instructions
                </CardTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-muted p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      User
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {createdUser.fullName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{createdUser.email}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Access
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground capitalize">
                      {createdUser.role}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {createdUser.role === ROLES.ADMIN
                        ? 'Global workspace oversight'
                        : createdUser.workspaceId
                          ? 'Workspace invitation included'
                          : 'No workspace assigned yet'}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-6 md:p-8">
                <div className="rounded-2xl border border-border bg-muted p-5">
                  <p className="text-sm font-semibold text-foreground">Next step for the user</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Ask the user to go to the app login area and select{' '}
                    <span className="font-medium text-foreground">Set password</span>. They should
                    use the email address below to find their invited account and create their
                    password.
                  </p>

                  <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Email to use
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {createdUser.email}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      data-test="register-copy-invite-message-button"
                      onClick={copyShareMessage}
                      className="flex-1 gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Copy Invite Message
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    data-test="register-create-another-user-button"
                    className="flex-1"
                    onClick={() => setCreatedUser(null)}
                  >
                    Create Another User
                  </Button>
                </div>

                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Why no password was created yet
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The password is intentionally created by the user, not by the admin. In this
                    internal flow, the user identifies the invited account with their email and then
                    creates their own password.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    data-test="register-back-to-users-button"
                    className="flex-1"
                    onClick={() => navigate('/admin/users')}
                  >
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
          <Card className="border-primary/10 bg-foreground text-background shadow-elevated">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-background/80">
                <UserPlus className="h-3.5 w-3.5" />
                Admin Action
              </div>
              <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                <span className="text-background">Task</span>
                <span className="text-blue-300">Manager</span>
              </div>
              <div>
                <CardTitle className="text-3xl leading-tight text-background md:text-4xl">
                  Create a user and define how they enter the platform
                </CardTitle>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  Global admins oversee every workspace. Regular users can be created with optional
                  workspace access so they land in the right place from the start.
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                <p className="text-sm font-semibold text-background">Role logic</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-300" />
                    <div>
                      <p className="text-sm font-semibold text-background">Admin</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Full platform access — user management, workspaces, intern data, and all
                        programme controls.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-300" />
                    <div>
                      <p className="text-sm font-semibold text-background">
                        Mentor / Intern / Leadership
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Scoped access based on role. Mentors manage interns; leadership sees
                        dashboards and profiles; interns manage their own profile.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-blue-300" />
                  <div>
                    <p className="text-sm font-semibold text-background">Password creation flow</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      New invited users create their own password from inside the app using their
                      internal email address after the account is created.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-3 border-b border-border/60 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
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
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Full Name
                  </label>
                  <Input
                    data-test="register-full-name-input"
                    {...register('fullName', {
                      required: 'Full name is required',
                      maxLength: { value: 50, message: 'Max 50 characters' },
                    })}
                    placeholder="John Doe"
                    className={`h-12 ${errors.fullName ? 'border-red-500' : 'border-border'}`}
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    data-test="register-email-input"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: EMAIL_REGEX,
                        message: 'Invalid email format',
                      },
                    })}
                    placeholder="user@company.com"
                    className={`h-12 ${errors.email ? 'border-red-500' : 'border-border'}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Office Hub
                  </label>
                  <Controller
                    name="hubId"
                    control={control}
                    rules={{ required: 'Hub is required' }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger
                          data-test="register-hub-select"
                          className={`h-12 bg-card text-foreground ${errors.hubId ? 'border-red-500' : 'border-border'}`}
                        >
                          <SelectValue placeholder="Select office hub" />
                        </SelectTrigger>
                        <SelectContent className="bg-card">
                          {hubs.map((hub) => (
                            <SelectItem
                              key={hub._id}
                              value={hub._id}
                              data-test={`register-hub-option-${hub._id}`}
                            >
                              {hub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.hubId && <p className="text-red-500 text-xs">{errors.hubId.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Every employee must belong to a company office hub.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Global Role
                  </label>
                  <Controller
                    name="role"
                    control={control}
                    rules={{ required: 'Role is required' }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger
                          data-test="register-global-role-select"
                          className={`h-12 bg-card text-foreground ${errors.role ? 'border-red-500' : 'border-border'}`}
                        >
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="bg-card">
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem
                              key={r.slug}
                              value={r.slug}
                              data-test={`register-global-role-option-${r.slug}`}
                            >
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    {isGlobalAdmin
                      ? 'Platform-wide admin access. No workspace assignment needed.'
                      : 'Non-admin users can optionally be assigned to a workspace below.'}
                  </p>
                </div>

                {isGlobalAdmin ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">Global admin access</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Admins automatically get platform-wide visibility across all workspaces and
                      can create workspaces, review them, and add users where needed. No workspace
                      role is required at account creation.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Workspace
                      </label>
                      <Controller
                        name="workspaceId"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger
                              data-test="register-workspace-select"
                              className="h-12 border-border bg-card text-foreground"
                            >
                              <SelectValue placeholder="Choose a workspace" />
                            </SelectTrigger>
                            <SelectContent className="bg-card">
                              <SelectItem value="none" data-test="register-workspace-option-none">
                                No workspace yet
                              </SelectItem>
                              {workspaces.map((workspace) => (
                                <SelectItem
                                  key={workspace._id}
                                  value={workspace._id}
                                  data-test={`register-workspace-option-${workspace._id}`}
                                >
                                  {workspace.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {loadingWorkspaces
                          ? 'Loading workspaces...'
                          : 'Optional: create a pending workspace invitation immediately.'}
                      </p>
                    </div>

                    {hasSelectedWorkspace && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                          Workspace Role
                        </label>
                        <Controller
                          name="workspaceRole"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger
                                data-test="register-workspace-role-select"
                                className="h-12 border-border bg-card text-foreground"
                              >
                                <SelectValue placeholder="Select workspace role" />
                              </SelectTrigger>
                              <SelectContent className="bg-card">
                                <SelectItem
                                  value="member"
                                  data-test="register-workspace-role-option-member"
                                >
                                  Member
                                </SelectItem>
                                <SelectItem
                                  value="admin"
                                  data-test="register-workspace-role-option-admin"
                                >
                                  Admin
                                </SelectItem>
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
                  data-test="register-submit-button"
                  disabled={isPending}
                  className="mt-4 h-12 w-full text-lg font-bold"
                >
                  {isPending ? 'Creating...' : 'Create User'}
                </Button>

                <div className="text-center pt-2 text-sm text-muted-foreground">
                  <button
                    type="button"
                    data-test="register-cancel-button"
                    onClick={() => navigate('/admin/users')}
                    className="font-semibold text-foreground hover:underline"
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
