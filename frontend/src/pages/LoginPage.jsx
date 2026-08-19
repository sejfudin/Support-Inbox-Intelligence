import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLoginUser } from '@/queries/auth';
import { TaskManagerBrand } from '@/components/TaskManagerBrand';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loginMutation = useLoginUser();

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage('');

    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => {
          const msg = error.response?.data?.message || 'Invalid email or password.';
          setErrorMessage(msg);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 flex h-screen w-screen items-center justify-center overflow-y-auto bg-transparent p-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="hidden border-primary/10 bg-foreground text-background shadow-elevated lg:block">
          <CardHeader className="p-10">
            <TaskManagerBrand size="xl" onDark showTagline linkTo={null} className="mb-8" />
            <div>
              <CardTitle className="text-4xl font-semibold leading-tight text-background">
                Stay on top of tickets, teams, and workspace operations.
              </CardTitle>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                A calmer, faster way to manage support work with a single professional control
                center for people, workflows, and progress.
              </p>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/50 bg-card shadow-elevated">
          <CardHeader className="space-y-3 pt-10 pb-6">
            <div className="flex justify-center lg:hidden">
              <TaskManagerBrand size="md" showTagline linkTo={null} />
            </div>
            <CardTitle className="text-center text-2xl font-semibold text-foreground md:text-3xl">
              Sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-12 pb-12">
            {errorMessage && (
              <div className="mb-4 p-3 bg-[hsl(var(--tone-danger)/0.15)] border border-[hsl(var(--tone-danger)/0.3)] text-[hsl(var(--tone-danger-fg))] rounded-[var(--r-control)] text-sm font-medium text-center">
                {errorMessage}
              </div>
            )}
            <form className="space-y-6" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-bold text-foreground uppercase tracking-wide"
                >
                  Email address
                </label>
                <Input
                  id="email"
                  data-test="login-email-input"
                  type="email"
                  placeholder="your@email.com"
                  required
                  className="h-14 text-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-bold text-foreground uppercase tracking-wide"
                >
                  Password
                </label>
                <Input
                  id="password"
                  data-test="login-password-input"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-14 text-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                data-test="login-submit-button"
                className="h-14 w-full text-xl font-semibold"
              >
                {loginMutation.isPending ? 'Signing in...' : 'Login'}
              </Button>

              <div className="rounded-[var(--r-card)] border border-border bg-muted p-4 text-center">
                <p className="text-sm font-semibold text-foreground">First time here?</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  If your admin created your account, use your internal email to set your password.
                </p>
                <Link
                  to="/set-password"
                  data-test="login-set-password-link"
                  className="mt-3 inline-flex text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Set password
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
