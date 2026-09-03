import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/register/RegisterForm';
import { RegisterRoleGuide } from '@/components/register/RegisterRoleGuide';
import { RegisterSuccess } from '@/components/register/RegisterSuccess';
import { getRegisterDefaultValues } from '@/helpers/registerForm';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';

export default function Register() {
  const [errorString, setErrorString] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  const methods = useForm({
    mode: 'onChange',
    defaultValues: getRegisterDefaultValues(),
  });

  const selectedRole = methods.watch('role');

  if (createdUser) {
    return (
      <RegisterSuccess
        createdUser={createdUser}
        onCreateAnother={() => {
          setCreatedUser(null);
          methods.reset(getRegisterDefaultValues());
        }}
      />
    );
  }

  return (
    // In flow inside `<main>`, not `fixed` — this route is always nested under
    // `SidebarLayout` (see AppRoutes.jsx), so covering the full viewport centred
    // the two-card grid against the whole window instead of the space beside the
    // sidebar. `min-h-[var(--app-vh)]`, not a raw `min-h-screen`, for the same
    // reason `PageShell` uses it — see the comment on `--app-vh` in `index.css`.
    <div className="min-h-[var(--app-vh)] w-full overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-border/50 bg-muted shadow-elevated dark:border-surface-border dark:bg-surface-elevated">
            <RegisterRoleGuide role={selectedRole} />
          </Card>

          <Card className="flex flex-col border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-4 border-b border-border/60 pb-6">
              <TaskManagerBrand size="md" linkTo={null} />
              <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
                Create User Account
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Fields update automatically based on the selected role.
              </p>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col px-6 pb-12 pt-6 md:px-12">
              {errorString && (
                <div
                  className="mb-6 rounded-[var(--r-control)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-[hsl(var(--tone-danger-fg))]"
                  data-test="register-error-alert"
                >
                  {errorString}
                </div>
              )}

              <FormProvider {...methods}>
                <RegisterForm onSuccess={setCreatedUser} onError={setErrorString} />
              </FormProvider>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
