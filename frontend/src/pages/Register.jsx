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

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorString, setErrorString] = useState("");

const {
  register,
  handleSubmit,
  watch,
  control,
  trigger,
  formState: { errors },
} = useForm({
  mode: "onChange",
  defaultValues: {
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "agent",
  },
});

  const password = watch("password");

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorString("");
    console.log("Form Data Submitted: ", data);
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
                    maxLength: { value: 50, message: "Max 50 characters" }
                  })}
                  placeholder="John Doe"
                  className={`h-12 ${errors.fullName ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
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
                      message: "Invalid email format"
                    }
                  })}
                  placeholder="agent@company.com"
                  className={`h-12 ${errors.email ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
              </div>

              {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Password
              </label>
              <Input
                type="password"
                {...register("password", { 
                  required: "Password is required",
                  minLength: { value: 6, message: "Min 6 characters" },
                  onChange: () => {
                    if (watch("confirmPassword")) {
                      trigger("confirmPassword");
                    }
                  }
                })}
                placeholder="••••••••"
                className={`h-12 ${errors.password ? "border-red-500" : "border-slate-300"}`}
              />
              {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  {...register("confirmPassword", { 
                    required: "Please confirm password",
                    validate: (val) => val === password || "Passwords do not match"
                  })}
                  placeholder="••••••••"
                  className={`h-12 ${errors.confirmPassword ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Role
                </label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="h-12 border-slate-300 bg-white text-slate-900">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all mt-4"
              >
                {loading ? "Creating..." : "Register User"}
              </Button>

              <div className="text-center pt-2 text-sm text-gray-600">
                <button 
                  type="button" 
                  onClick={() => navigate("/dashboard")}
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