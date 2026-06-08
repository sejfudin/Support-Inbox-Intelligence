import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
import { useRegisterUser } from '@/queries/auth';
import { useHubs } from '@/queries/hubs';
import { useInternshipTypes } from '@/queries/internshipTypes';
import { useMentorCandidates } from '@/queries/users';
import { useAllWorkspaces } from '@/queries/workspaces';
import { ROLE_OPTIONS } from '@/helpers/roles';
import {
  REGISTER_DEFAULT_VALUES,
  buildRegisterPayload,
  isInternRole,
  showsWorkspaceSelection,
  skipsWorkspaceSelection,
} from '@/helpers/registerForm';
import { toast } from 'sonner';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function FormField({ label, htmlFor, error, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-[0.14em]">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, first = false }) {
  return (
    <div className={first ? 'pb-1' : 'border-t border-border/60 pt-5'}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

export function RegisterForm({ onSuccess, onError }) {
  const navigate = useNavigate();
  const { mutate, isPending } = useRegisterUser();
  const { data: hubs = [] } = useHubs();
  const { data: internshipTypes = [] } = useInternshipTypes();
  const { data: workspaces = [], isLoading: loadingWorkspaces } = useAllWorkspaces();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useFormContext();

  const selectedRole = watch('role');
  const selectedHubId = watch('hubId');
  const selectedWorkspaceId = watch('workspaceId');
  const showInternFields = isInternRole(selectedRole);
  const showWorkspaceFields = showsWorkspaceSelection(selectedRole);
  const hasSelectedWorkspace = selectedWorkspaceId && selectedWorkspaceId !== 'none';

  const { data: hubMentorsData } = useMentorCandidates({
    hubId: selectedHubId,
    hubScoped: true,
  });
  const { data: allMentorsData } = useMentorCandidates({ hubScoped: false });

  const hubMentors = hubMentorsData?.users ?? [];
  const allMentors = allMentorsData?.users ?? [];

  useEffect(() => {
    if (skipsWorkspaceSelection(selectedRole)) {
      setValue('workspaceId', 'none');
      setValue('workspaceRole', 'member');
    }
  }, [selectedRole, setValue]);

  useEffect(() => {
    if (!showInternFields) {
      setValue('internshipTypeId', '');
      setValue('primaryMentorId', '');
      setValue('secondaryMentorId', 'none');
      setValue('startDate', '');
    }
  }, [showInternFields, setValue]);

  useEffect(() => {
    if (!hasSelectedWorkspace) {
      setValue('workspaceRole', 'member');
    }
  }, [hasSelectedWorkspace, setValue]);

  useEffect(() => {
    setValue('primaryMentorId', '');
  }, [selectedHubId, setValue]);

  const onSubmit = (data) => {
    onError?.('');
    const loadingToast = toast.loading('Creating user account...');
    const payload = buildRegisterPayload(data);

    mutate(payload, {
      onSuccess: (result) => {
        toast.dismiss(loadingToast);

        if (result?.requiresPasswordSetup) {
          onSuccess?.({
            fullName: data.fullName,
            email: data.email,
            role: data.role,
            workspaceId: payload.workspaceId,
          });
          toast.success('User created successfully');
          reset(REGISTER_DEFAULT_VALUES);
        } else {
          toast.success('User registered successfully');
          navigate('/admin/users');
        }
      },
      onError: (err) => {
        toast.dismiss(loadingToast);
        const message = err?.response?.data?.message || 'Registration failed';
        onError?.(message);
        toast.error(message);
      },
    });
  };

  const inputClass = (hasError) =>
    `h-11 bg-background ${hasError ? 'border-destructive' : 'border-border'}`;

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle first>Identity</SectionTitle>

      <FormField label="Full name" htmlFor="register-full-name" error={errors.fullName?.message}>
        <Input
          id="register-full-name"
          data-test="register-full-name-input"
          placeholder="John Doe"
          className={inputClass(errors.fullName)}
          {...register('fullName', {
            required: 'Full name is required',
            maxLength: { value: 50, message: 'Max 50 characters' },
          })}
        />
      </FormField>

      <FormField label="Email address" htmlFor="register-email" error={errors.email?.message}>
        <Input
          id="register-email"
          type="email"
          data-test="register-email-input"
          placeholder="name@symphony.is"
          className={inputClass(errors.email)}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: EMAIL_REGEX, message: 'Invalid email format' },
          })}
        />
      </FormField>

      <SectionTitle>Role &amp; hub</SectionTitle>

      <FormField
        label="Office hub"
        htmlFor="register-hub"
        error={errors.hubId?.message}
        hint="Every employee belongs to a company office hub."
      >
        <Controller
          name="hubId"
          control={control}
          rules={{ required: 'Hub is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger
                id="register-hub"
                data-test="register-hub-select"
                className={inputClass(errors.hubId)}
              >
                <SelectValue placeholder="Select office hub" />
              </SelectTrigger>
              <SelectContent>
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
      </FormField>

      <FormField
        label="Platform role"
        htmlFor="register-role"
        error={errors.role?.message}
        hint={
          skipsWorkspaceSelection(selectedRole)
            ? 'This role does not use workspace assignment.'
            : 'Workspace invitation is optional for this role.'
        }
      >
        <Controller
          name="role"
          control={control}
          rules={{ required: 'Role is required' }}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger
                id="register-role"
                data-test="register-global-role-select"
                className={inputClass(errors.role)}
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
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
      </FormField>

      {showInternFields && (
        <>
          <SectionTitle>Internship programme</SectionTitle>

          <FormField
            label="Internship type"
            htmlFor="register-internship-type"
            error={errors.internshipTypeId?.message}
          >
            <Controller
              name="internshipTypeId"
              control={control}
              rules={{ required: 'Internship type is required' }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="register-internship-type"
                    data-test="register-internship-type-select"
                    className={inputClass(errors.internshipTypeId)}
                  >
                    <SelectValue placeholder="Select programme track" />
                  </SelectTrigger>
                  <SelectContent>
                    {internshipTypes.map((type) => (
                      <SelectItem
                        key={type._id}
                        value={type._id}
                        data-test={`register-internship-type-option-${type.slug}`}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Internship start date"
            htmlFor="register-start-date"
            error={errors.startDate?.message}
          >
            <Input
              id="register-start-date"
              type="date"
              data-test="register-start-date-input"
              className={inputClass(errors.startDate)}
              {...register('startDate', { required: 'Start date is required' })}
            />
          </FormField>

          <FormField
            label="Primary mentor"
            htmlFor="register-primary-mentor"
            error={errors.primaryMentorId?.message}
            hint={
              !selectedHubId
                ? 'Select a hub first to list hub mentors.'
                : 'Must be an admin or mentor from the same hub.'
            }
          >
            <Controller
              name="primaryMentorId"
              control={control}
              rules={{ required: 'Primary mentor is required' }}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedHubId}
                >
                  <SelectTrigger
                    id="register-primary-mentor"
                    data-test="register-primary-mentor-select"
                    className={inputClass(errors.primaryMentorId)}
                  >
                    <SelectValue placeholder="Select primary mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubMentors.map((mentor) => (
                      <SelectItem
                        key={mentor._id}
                        value={mentor._id}
                        data-test={`register-primary-mentor-option-${mentor._id}`}
                      >
                        {mentor.fullname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Secondary mentor (optional)"
            htmlFor="register-secondary-mentor"
            hint="Area mentor for DS, ML, QA, or other tracks outside the main hub mentor."
          >
            <Controller
              name="secondaryMentorId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="register-secondary-mentor"
                    data-test="register-secondary-mentor-select"
                    className={inputClass(false)}
                  >
                    <SelectValue placeholder="No secondary mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-test="register-secondary-mentor-option-none">
                      No secondary mentor
                    </SelectItem>
                    {allMentors.map((mentor) => (
                      <SelectItem
                        key={mentor._id}
                        value={mentor._id}
                        data-test={`register-secondary-mentor-option-${mentor._id}`}
                      >
                        {mentor.fullname}
                        {mentor.hub?.name ? ` · ${mentor.hub.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </>
      )}

      {showWorkspaceFields && (
        <>
          <SectionTitle>Task manager (optional)</SectionTitle>

          <FormField
            label="Workspace"
            htmlFor="register-workspace"
            hint={
              loadingWorkspaces
                ? 'Loading workspaces...'
                : 'Optionally invite the user to a project workspace now.'
            }
          >
            <Controller
              name="workspaceId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="register-workspace"
                    data-test="register-workspace-select"
                    className={inputClass(false)}
                  >
                    <SelectValue placeholder="No workspace yet" />
                  </SelectTrigger>
                  <SelectContent>
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
          </FormField>

          {hasSelectedWorkspace && (
            <FormField label="Workspace role" htmlFor="register-workspace-role">
              <Controller
                name="workspaceRole"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      id="register-workspace-role"
                      data-test="register-workspace-role-select"
                      className={inputClass(false)}
                    >
                      <SelectValue placeholder="Select workspace role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member" data-test="register-workspace-role-option-member">
                        Member
                      </SelectItem>
                      <SelectItem value="admin" data-test="register-workspace-role-option-admin">
                        Admin
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          data-test="register-cancel-button"
          onClick={() => navigate('/admin/users')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 flex-1"
          data-test="register-submit-button"
        >
          {isPending ? 'Creating...' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}
