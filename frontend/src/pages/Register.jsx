import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/register/RegisterForm';
import { RegisterRoleGuide } from '@/components/register/RegisterRoleGuide';
import { RegisterSuccess } from '@/components/register/RegisterSuccess';
import { REGISTER_DEFAULT_VALUES } from '@/helpers/registerForm';

export default function Register() {
  const [errorString, setErrorString] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  const methods = useForm({
    mode: 'onChange',
    defaultValues: REGISTER_DEFAULT_VALUES,
  });

  const selectedRole = methods.watch('role');

  if (createdUser) {
    return (
      <RegisterSuccess
        createdUser={createdUser}
        onCreateAnother={() => {
          setCreatedUser(null);
          methods.reset(REGISTER_DEFAULT_VALUES);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-border/50 bg-card shadow-elevated">
            <RegisterRoleGuide role={selectedRole} />
          </Card>

          <Card className="border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-3 border-b border-border/60 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
                Create User Account
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Fields update automatically based on the selected role.
              </p>
            </CardHeader>

            <CardContent className="px-6 pb-12 pt-6 md:px-12">
              {errorString && (
                <div
                  className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
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
