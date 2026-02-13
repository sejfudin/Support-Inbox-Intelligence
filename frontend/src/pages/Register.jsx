import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegisterUser } from "@/queries/auth";
import { toast } from "sonner";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const Register = () => {
  const navigate = useNavigate();
  const [errorString, setErrorString] = useState("");
  const { mutate, isPending } = useRegisterUser();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      role: "user",
    },
  });

  const onSubmit = (data) => {
    setErrorString("");
    const loadingToast = toast.loading("Creating user account...");
    mutate(data, {
      onSuccess: () => {
        toast.dismiss(loadingToast); 
        
        toast.success("User registered successfully", {
          description: `Account for ${data.fullName} has been created.`,
        });
        navigate("/admin/users");
      },
      onError: (err) => {
        toast.dismiss(loadingToast);
        
        const message = err?.response?.data?.message || "Registration failed";
        setErrorString(message);
        
        toast.error("Error", {
          description: message,
        });
      },
    });
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md md:max-w-xl">
        <Card className="shadow-2xl border-slate-200 bg-white">
          <CardHeader className="pt-10 pb-6">
            <CardTitle className="text-2xl md:text-3xl text-center font-extrabold text-gray-900">
              Create User Account
            </CardTitle>
          </CardHeader>

          <CardContent className="px-6 md:px-12 pb-12">
            {errorString && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                {errorString}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Full Name
                </label>
                <Input
                  {...register("fullName", {
                    required: "Full name is required",
                    maxLength: { value: 50, message: "Max 50 characters" },
                  })}
                  placeholder="John Doe"
                  className={`h-12 ${errors.fullName ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Email Address
                </label>
                <Input
                  type="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: EMAIL_REGEX,
                      message: "Invalid email format",
                    },
                  })}
                  placeholder="user@company.com"
                  className={`h-12 ${errors.email ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Role
                </label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-900">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all mt-4"
              >
                {isPending ? "Creating..." : "Register User"}
              </Button>

              <div className="text-center pt-2 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => navigate("/admin/users")}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  Cancel and return
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
