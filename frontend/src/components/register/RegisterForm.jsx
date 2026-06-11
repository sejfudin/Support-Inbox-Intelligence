import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  UserRound,
} from 'lucide-react';
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
  buildRegisterPayload,
  buildSuggestedEmail,
  findDefaultHubId,
  findDefaultInternshipTypeId,
  getRegisterDefaultValues,
  getTodayIsoDate,
  isInternRole,
  showsWorkspaceSelection,
  skipsWorkspaceSelection,
} from '@/helpers/registerForm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const REGISTER_STEPS = {
  identity: {
    id: 'identity',
    label: 'Personal information',
    icon: UserRound,
    fields: ['fullName', 'email', 'hubId', 'role'],
  },
  programme: {
    id: 'programme',
    label: 'Internship programme',
    icon: GraduationCap,
    fields: ['internshipTypeId', 'startDate', 'primaryMentorId', 'secondaryMentorId'],
  },
  taskManager: {
    id: 'taskManager',
    label: 'Task manager',
    icon: ClipboardList,
    fields: ['workspaceId', 'workspaceRole'],
  },
};

function FormField({ label, htmlFor, error, hint, children }) {
  return (
    <div className="flex min-h-[6.5rem] flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      <div className="min-h-9">
        {error && <p className="text-xs leading-5 text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function StepHeading({ step, stepIndex, stepCount }) {
  return (
    <div className="border-b border-border/60 pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Step {stepIndex + 1} of {stepCount}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{step.label}</h2>
    </div>
  );
}

function RegisterStepNav({ steps, activeStepId, activeStepIndex, errors, onStepSelect }) {
  return (
    <div className="rounded-xl bg-transparent">
      <div className="grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === activeStepId;
          const hasError = step.fields.some((field) => errors[field]);
          const isComplete = index < activeStepIndex && !hasError;

          return (
            <button
              key={step.id}
              type="button"
              className={cn(
                'group relative flex min-h-20 items-start gap-3 rounded-lg border border-transparent px-2.5 pb-4 pt-2.5 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground',
                isComplete && 'text-primary/80',
                hasError && 'text-destructive'
              )}
              aria-current={isActive ? 'step' : undefined}
              data-test={`register-step-${step.id}`}
              onClick={() => onStepSelect(index)}
            >
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(50%+1.4rem)] right-[calc(-50%+1.4rem)] top-7 hidden h-px bg-[#E2E5EF] sm:block"
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground',
                  isComplete && 'border-emerald-200 bg-emerald-50 text-emerald-600',
                  hasError && 'border-destructive bg-destructive text-destructive-foreground'
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]">
                  Step {index + 1}
                </span>
                <span className="mt-0.5 block text-sm font-semibold leading-snug">
                  {step.label}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-colors',
                  isActive ? 'bg-primary' : 'bg-transparent',
                  hasError && 'bg-destructive'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RegisterForm({ onSuccess, onError }) {
  const navigate = useNavigate();
  const [activeStepId, setActiveStepId] = useState(REGISTER_STEPS.identity.id);
  const { mutate, isPending } = useRegisterUser();
  const { data: hubs = [] } = useHubs();
  const { data: internshipTypes = [] } = useInternshipTypes();
  const { data: workspaces = [], isLoading: loadingWorkspaces } = useAllWorkspaces();

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useFormContext();

  const lastSuggestedEmailRef = useRef('');
  const fullName = watch('fullName');
  const selectedRole = watch('role');
  const selectedHubId = watch('hubId');
  const selectedInternshipTypeId = watch('internshipTypeId');
  const selectedStartDate = watch('startDate');
  const selectedWorkspaceId = watch('workspaceId');
  const showInternFields = isInternRole(selectedRole);
  const showWorkspaceFields = showsWorkspaceSelection(selectedRole);
  const hasSelectedWorkspace = selectedWorkspaceId && selectedWorkspaceId !== 'none';

  const visibleSteps = useMemo(() => {
    const steps = [REGISTER_STEPS.identity];

    if (!selectedRole || showInternFields) {
      steps.push(REGISTER_STEPS.programme);
    }

    if (!selectedRole || showWorkspaceFields) {
      steps.push(REGISTER_STEPS.taskManager);
    }

    return steps;
  }, [selectedRole, showInternFields, showWorkspaceFields]);

  const activeStepIndex = Math.max(
    visibleSteps.findIndex((step) => step.id === activeStepId),
    0
  );
  const activeStep = visibleSteps[activeStepIndex] ?? visibleSteps[0];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === visibleSteps.length - 1;

  const { data: allMentorsData } = useMentorCandidates({ hubScoped: false });

  const allMentors = allMentorsData?.users ?? [];

  useEffect(() => {
    if (skipsWorkspaceSelection(selectedRole)) {
      setValue('workspaceId', 'none');
      setValue('workspaceRole', 'member');
    }
  }, [selectedRole, setValue]);

  useEffect(() => {
    const suggestedEmail = buildSuggestedEmail(fullName);
    if (!suggestedEmail) return;

    const currentEmail = getValues('email');
    if (!currentEmail || currentEmail === lastSuggestedEmailRef.current) {
      setValue('email', suggestedEmail, { shouldValidate: Boolean(fullName.trim()) });
    }

    lastSuggestedEmailRef.current = suggestedEmail;
  }, [fullName, getValues, setValue]);

  useEffect(() => {
    if (!hubs.length || selectedHubId) return;
    const defaultHubId = findDefaultHubId(hubs);
    if (defaultHubId) setValue('hubId', defaultHubId);
  }, [hubs, selectedHubId, setValue]);

  useEffect(() => {
    if (!showInternFields) {
      setValue('internshipTypeId', '');
      setValue('primaryMentorId', '');
      setValue('secondaryMentorId', 'none');
      setValue('startDate', '');
      return;
    }

    if (!selectedStartDate) {
      setValue('startDate', getTodayIsoDate());
    }

    if (!internshipTypes.length || selectedInternshipTypeId) return;
    const defaultTypeId = findDefaultInternshipTypeId(internshipTypes);
    if (defaultTypeId) setValue('internshipTypeId', defaultTypeId);
  }, [showInternFields, internshipTypes, selectedInternshipTypeId, selectedStartDate, setValue]);

  useEffect(() => {
    if (!hasSelectedWorkspace) {
      setValue('workspaceRole', 'member');
    }
  }, [hasSelectedWorkspace, setValue]);

  useEffect(() => {
    if (!visibleSteps.some((step) => step.id === activeStepId)) {
      setActiveStepId(REGISTER_STEPS.identity.id);
    }
  }, [activeStepId, visibleSteps]);

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
          const defaults = getRegisterDefaultValues();
          const defaultHubId = findDefaultHubId(hubs);
          const defaultTypeId = findDefaultInternshipTypeId(internshipTypes);
          if (defaultHubId) defaults.hubId = defaultHubId;
          if (defaultTypeId) defaults.internshipTypeId = defaultTypeId;
          reset(defaults);
          lastSuggestedEmailRef.current = '';
          setActiveStepId(REGISTER_STEPS.identity.id);
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
    cn(
      'h-11 rounded-lg bg-background placeholder:text-[#9AA2B1] data-[placeholder]:text-[#9AA2B1]',
      hasError ? 'border-destructive' : 'border-border'
    );

  const validateStep = (step) => trigger(step.fields, { shouldFocus: true });

  const handleNextStep = async () => {
    const isValid = await validateStep(activeStep);

    if (!isValid) return;

    const nextStep = visibleSteps[activeStepIndex + 1];
    if (nextStep) setActiveStepId(nextStep.id);
  };

  const handlePreviousStep = () => {
    const previousStep = visibleSteps[activeStepIndex - 1];
    if (previousStep) setActiveStepId(previousStep.id);
  };

  const handleStepSelect = async (targetIndex) => {
    if (targetIndex <= activeStepIndex) {
      setActiveStepId(visibleSteps[targetIndex].id);
      return;
    }

    for (let index = activeStepIndex; index < targetIndex; index += 1) {
      const isValid = await validateStep(visibleSteps[index]);

      if (!isValid) {
        setActiveStepId(visibleSteps[index].id);
        return;
      }
    }

    setActiveStepId(visibleSteps[targetIndex].id);
  };

  const handleInvalidSubmit = (formErrors) => {
    const stepWithError = visibleSteps.find((step) =>
      step.fields.some((field) => formErrors[field])
    );

    if (stepWithError) setActiveStepId(stepWithError.id);
  };

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}
    >
      <RegisterStepNav
        steps={visibleSteps}
        activeStepId={activeStep.id}
        activeStepIndex={activeStepIndex}
        errors={errors}
        onStepSelect={handleStepSelect}
      />

      <div className="space-y-6">
        <StepHeading
          step={activeStep}
          stepIndex={activeStepIndex}
          stepCount={visibleSteps.length}
        />

        <div
          className={cn(
            activeStep.id === REGISTER_STEPS.identity.id ? 'grid gap-5 md:grid-cols-2' : 'hidden'
          )}
        >
          <FormField
            label="Full name"
            htmlFor="register-full-name"
            error={errors.fullName?.message}
          >
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
        </div>

        {showInternFields && (
          <div
            className={cn(
              activeStep.id === REGISTER_STEPS.programme.id ? 'grid gap-5 md:grid-cols-2' : 'hidden'
            )}
          >
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
              hint="Select any active admin or mentor."
            >
              <Controller
                name="primaryMentorId"
                control={control}
                rules={{ required: 'Primary mentor is required' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      id="register-primary-mentor"
                      data-test="register-primary-mentor-select"
                      className={inputClass(errors.primaryMentorId)}
                    >
                      <SelectValue placeholder="Select primary mentor" />
                    </SelectTrigger>
                    <SelectContent>
                      {allMentors.map((mentor) => (
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
          </div>
        )}

        {showWorkspaceFields && (
          <div
            className={cn(
              activeStep.id === REGISTER_STEPS.taskManager.id
                ? 'grid gap-5 md:grid-cols-2'
                : 'hidden'
            )}
          >
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
                        <SelectItem
                          value="member"
                          data-test="register-workspace-role-option-member"
                        >
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
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-lg px-5 sm:w-auto"
          data-test="register-cancel-button"
          onClick={() => navigate('/admin/users')}
        >
          Cancel
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {!isFirstStep && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg px-5 sm:min-w-28"
              data-test="register-previous-button"
              onClick={handlePreviousStep}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {!isLastStep && (
            <Button
              type="button"
              className="h-11 w-full rounded-lg px-5 sm:min-w-28"
              data-test="register-next-button"
              onClick={handleNextStep}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {isLastStep && (
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-lg px-5 sm:min-w-32"
              data-test="register-submit-button"
            >
              <Check className="h-4 w-4" />
              {isPending ? 'Creating...' : 'Create user'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
