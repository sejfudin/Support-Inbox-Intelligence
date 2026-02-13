import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { verifyInvite, setPasswordFromInvite } from "@/api/invite";
import { useAuth } from "@/context/AuthContext";

const MIN_LEN = 6;

export default function SetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const { refetchUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password");

  useEffect(() => {
    const run = async () => {
      setError("");

      if (!token) {
        setLoading(false);
        setError("Missing invite token.");
        return;
      }

      try {
        const data = await verifyInvite(token);
        setInviteInfo(data);

        window.history.replaceState({}, "", "/set-password");
      } catch {
        setError("Invalid or expired invite link.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  const onSubmit = async (values) => {
    setError("");
    const loadingToast = toast.loading("Activating your account...");

    try {
      const data = await setPasswordFromInvite(values.password);

      localStorage.setItem("accessToken", data.accessToken);

      await refetchUser();

      toast.dismiss(loadingToast);
      toast.success("Account activated", {
        description: "You are now logged in.",
      });

      navigate("/workspace");
    } catch (e) {
      toast.dismiss(loadingToast);
      const msg =
        e?.response?.data?.message ||
        "Setup session expired. Re-open invite link.";
      setError(msg);
      toast.error("Error", { description: msg });
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md md:max-w-xl">
        <Card className="shadow-2xl border-slate-200 bg-white">
          <CardHeader className="pt-10 pb-6">
            <CardTitle className="text-2xl md:text-3xl text-center font-extrabold text-gray-900">
              Set your password
            </CardTitle>
          </CardHeader>

          <CardContent className="px-6 md:px-12 pb-12">
            {loading && (
              <div className="text-center text-sm text-gray-600">
                Verifying invite…
              </div>
            )}

            {!loading && error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="mb-6 text-sm text-gray-600 text-center">
                  Hi{" "}
                  <span className="font-semibold text-gray-900">
                    {inviteInfo?.fullName || "there"}
                  </span>
                  {inviteInfo?.email ? (
                    <>
                      {" "}
                      (
                      <span className="font-semibold text-gray-900">
                        {inviteInfo.email}
                      </span>
                      )
                    </>
                  ) : null}
                  , set a password to activate your account.
                </div>

                <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••"
                      className={`h-12 ${errors.password ? "border-red-500" : "border-slate-300"}`}
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: MIN_LEN,
                          message: `Min ${MIN_LEN} characters`,
                        },
                      })}
                    />
                    {errors.password && (
                      <p className="text-red-500 text-xs">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Confirm Password
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••"
                      className={`h-12 ${
                        errors.confirmPassword
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                      {...register("confirmPassword", {
                        required: "Please confirm password",
                        validate: (val) =>
                          val === password || "Passwords do not match",
                      })}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-xs">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all mt-4"
                  >
                    Activate account
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
