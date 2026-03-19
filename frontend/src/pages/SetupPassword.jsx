import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyInvite, setPasswordFromInvite } from "@/api/invite";
import { useAuth } from "@/context/AuthContext";

const MIN_LEN = 6;

export default function SetPassword() {
  const navigate = useNavigate();
  const { refetchUser, isAuthenticated, loading } = useAuth();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);

  const emailForm = useForm({
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const passwordForm = useForm({
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = passwordForm.watch("password");

  const onEmailSubmit = async ({ email }) => {
    setError("");
    setEmailChecking(true);

    try {
      const data = await verifyInvite({ email });
      setInviteInfo(data);
      toast.success("Account found", {
        description: "You can now create your password.",
      });
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        "No invited account was found for that email address.";
      setError(message);
    } finally {
      setEmailChecking(false);
    }
  };

  const onPasswordSubmit = async ({ password }) => {
    setError("");
    const loadingToast = toast.loading("Activating your account...");

    try {
      const data = await setPasswordFromInvite(password);

      localStorage.setItem("accessToken", data.accessToken);
      await refetchUser();

      toast.dismiss(loadingToast);
      toast.success("Account activated", {
        description: "You are now logged in.",
      });

      navigate("/");
    } catch (e) {
      toast.dismiss(loadingToast);
      const message =
        e?.response?.data?.message ||
        "Setup session expired. Enter your email again.";
      setError(message);
      toast.error("Error", { description: message });
    }
  };

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto bg-transparent p-4">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center py-6 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-primary/10 bg-slate-950 text-white shadow-[0_32px_80px_-40px_rgba(35,39,92,0.95)]">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                <KeyRound className="h-3.5 w-3.5" />
                Password Setup
              </div>
              <div className="text-3xl font-semibold tracking-tight md:text-4xl">
                <span className="text-white">Task</span>
                <span className="text-blue-300">Manager</span>
              </div>
              <div>
                <CardTitle className="text-3xl leading-tight text-white md:text-4xl">
                  Activate your internal account
                </CardTitle>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Enter the email address your admin used when creating your account. If it exists
                  in the system as an invited user, you&apos;ll be able to set your password right away.
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-300" />
                  <div>
                    <p className="text-sm font-semibold text-white">Internal setup flow</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      This setup page works only for invited internal users who have not activated
                      their account yet.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white shadow-[0_24px_60px_-30px_rgba(76,81,191,0.38)]">
            <CardHeader className="space-y-3 border-b border-slate-100 pb-6">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
              <CardTitle className="text-2xl font-bold text-slate-900 md:text-3xl">
                {inviteInfo ? "Create Your Password" : "Find Your Account"}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 px-6 pb-12 pt-6 md:px-12">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">
                  {error}
                </div>
              )}

              {!inviteInfo ? (
                <form className="space-y-5" onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="your@company.com"
                      className={`h-12 ${
                        emailForm.formState.errors.email ? "border-red-500" : "border-slate-300"
                      }`}
                      {...emailForm.register("email", {
                        required: "Email is required",
                      })}
                    />
                    {emailForm.formState.errors.email && (
                      <p className="text-xs text-red-500">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" disabled={emailChecking} className="h-12 w-full text-base font-semibold">
                    {emailChecking ? "Checking account..." : "Continue"}
                  </Button>
                </form>
              ) : (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Account found for {inviteInfo.fullName}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{inviteInfo.email}</p>
                      </div>
                    </div>
                  </div>

                  <form className="space-y-5" onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••"
                        className={`h-12 ${
                          passwordForm.formState.errors.password ? "border-red-500" : "border-slate-300"
                        }`}
                        {...passwordForm.register("password", {
                          required: "Password is required",
                          minLength: {
                            value: MIN_LEN,
                            message: `Min ${MIN_LEN} characters`,
                          },
                        })}
                      />
                      {passwordForm.formState.errors.password && (
                        <p className="text-xs text-red-500">
                          {passwordForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Confirm Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••"
                        className={`h-12 ${
                          passwordForm.formState.errors.confirmPassword ? "border-red-500" : "border-slate-300"
                        }`}
                        {...passwordForm.register("confirmPassword", {
                          required: "Please confirm password",
                          validate: (val) => val === password || "Passwords do not match",
                        })}
                      />
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="text-xs text-red-500">
                          {passwordForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <Button type="submit" className="h-12 w-full text-base font-semibold">
                      Activate Account
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setInviteInfo(null);
                        setError("");
                        passwordForm.reset();
                      }}
                      className="w-full text-sm font-medium text-slate-500 underline underline-offset-4 hover:text-slate-900"
                    >
                      Use a different email
                    </button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
