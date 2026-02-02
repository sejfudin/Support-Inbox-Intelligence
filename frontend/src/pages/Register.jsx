import { useState } from "react";
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
const Register = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");

  const handleRegister = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    console.log({ fullName, email, password });
    navigate("/dashboard");
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md md:max-w-xl">
        <Card className="shadow-2xl border-slate-200">
          <CardHeader className="pt-10 pb-6">
            <CardTitle className="text-2xl md:text-3xl text-center font-extrabold text-gray-900">
              Create your account
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-12 pb-12">
            <form className="space-y-6" onSubmit={handleRegister}>
              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  required
                  className="h-14 text-lg border-slate-300 focus:ring-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

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
                  className="h-14 text-lg border-slate-300 focus:ring-2"
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
                  className="h-14 text-lg border-slate-300 focus:ring-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-14 text-lg border-slate-300 focus:ring-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {/* Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                  Role
                </label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger className="h-14 bg-slate-900 text-white border-black">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>

                  <SelectContent
                    position="popper"
                    sideOffset={5}
                    className="bg-gray-100 border border-gray-200 shadow-xl z-[100]"
                  >
                    <SelectItem
                      value="agent"
                      className="text-slate-900 focus:bg-slate-800 focus:text-white cursor-pointer py-3"
                    >
                      Agent
                    </SelectItem>
                    <SelectItem
                      value="admin"
                      className="text-slate-900 focus:bg-slate-800 focus:text-white cursor-pointer py-3"
                    >
                      Admin
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full h-14 text-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all transform active:scale-[0.98]"
              >
                Register
              </Button>

              <div className="text-center pt-4 text-gray-600">
                Already have an account?
                <a
                  href="/login"
                  className="pl-2 font-semibold text-gray-900 hover:text-gray-700 transition"
                >
                  Sign In
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
