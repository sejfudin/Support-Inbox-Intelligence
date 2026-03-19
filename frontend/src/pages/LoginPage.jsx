import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoginUser } from "@/queries/auth";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loginMutation = useLoginUser();

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage("");

    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => {
          const msg =
            error.response?.data?.message || "Invalid email or password.";
          setErrorMessage(msg);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 flex h-screen w-screen items-center justify-center overflow-y-auto bg-transparent p-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="hidden border-primary/10 bg-slate-950 text-white shadow-[0_32px_80px_-40px_rgba(35,39,92,0.95)] lg:block">
          <CardHeader className="space-y-6 p-10">
            <div className="app-kicker w-fit border-white/10 bg-white/10 text-white/90">TaskManager</div>
            <div>
              <CardTitle className="text-4xl font-semibold leading-tight text-white">
                Stay on top of tickets, teams, and workspace operations.
              </CardTitle>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                A calmer, faster way to manage support work with a single professional control
                center for people, workflows, and progress.
              </p>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-white/70 bg-white/92 shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
          <CardHeader className="space-y-4 pt-10 pb-6">
            <div className="text-center">
              <div className="text-3xl font-semibold tracking-tight">
                <span className="text-foreground">Task</span>
                <span className="text-primary">Manager</span>
              </div>
            </div>
            <CardTitle className="text-center text-2xl font-semibold text-gray-900 md:text-3xl">
              Sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-12 pb-12">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm font-medium text-center">
                {errorMessage}
              </div>
            )}
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  className="h-14 text-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Password
                </label>
                <Input
                  id="password"
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
                className="h-14 w-full text-xl font-semibold"
              >
                {loginMutation.isPending ? "Signing in..." : "Login"}
              </Button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-sm font-semibold text-slate-900">First time here?</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  If your admin created your account, use your internal email to set your password.
                </p>
                <Link
                  to="/set-password"
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
