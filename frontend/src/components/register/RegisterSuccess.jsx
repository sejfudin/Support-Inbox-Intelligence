import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLES, getRoleLabel } from '@/helpers/roles';
import { toast } from 'sonner';

export function RegisterSuccess({ createdUser, onCreateAnother }) {
  const navigate = useNavigate();

  const copyShareMessage = async () => {
    if (!createdUser?.email) return;
    const message = `Hi ${createdUser.fullName}, your TaskManager account is ready. Open the app, choose "Set password", and enter this email address to activate your account: ${createdUser.email}`;
    await navigator.clipboard.writeText(message);
    toast.success('Invite message copied');
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Account created
              </div>
              <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                <span className="text-foreground">Task</span>
                <span className="text-primary">Manager</span>
              </div>
              <div>
                <CardTitle className="text-2xl leading-tight text-foreground md:text-3xl">
                  The user still needs to create a password
                </CardTitle>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  The account is ready. They can open TaskManager, choose{' '}
                  <span className="font-semibold text-foreground">Set password</span>, and continue
                  using their internal email address.
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">What happens next</p>
                <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">
                      1
                    </span>
                    Tell the user to open TaskManager
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">
                      2
                    </span>
                    They choose Set password and enter their email
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">
                      3
                    </span>
                    They can then log in and use the app
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card shadow-elevated">
            <CardHeader className="space-y-4 border-b border-border/60 pb-6">
              <CardTitle className="text-2xl font-bold text-foreground md:text-3xl">
                Share activation instructions
              </CardTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    User
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {createdUser.fullName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{createdUser.email}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Access
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {getRoleLabel(createdUser.role)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {createdUser.role === ROLES.ADMIN && 'Global workspace oversight'}
                    {createdUser.role === ROLES.LEADERSHIP && 'Leadership dashboards and profiles'}
                    {createdUser.role === ROLES.MENTOR &&
                      (createdUser.workspaceId
                        ? 'Mentor access with workspace invitation'
                        : 'Mentor access — no workspace yet')}
                    {createdUser.role === ROLES.INTERN &&
                      (createdUser.workspaceId
                        ? 'Intern profile with workspace invitation'
                        : 'Intern profile created — no workspace yet')}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <p className="text-sm font-semibold text-foreground">Next step for the user</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ask them to go to the login area and select{' '}
                  <span className="font-medium text-foreground">Set password</span>. They should use
                  the email address below.
                </p>
                <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Email to use
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {createdUser.email}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={copyShareMessage}
                  className="mt-4 w-full gap-2"
                  data-test="register-copy-invite-message-button"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Copy invite message
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCreateAnother}
                  className="flex-1"
                  data-test="register-create-another-user-button"
                >
                  Create another user
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/admin/users')}
                  className="flex-1"
                  data-test="register-back-to-users-button"
                >
                  Back to all users
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
