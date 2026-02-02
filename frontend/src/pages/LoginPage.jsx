import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md md:max-w-xl">
        <Card className="shadow-2xl border-slate-200">
          <CardHeader className="pt-10 pb-6">
            <CardTitle className="text-2xl md:text-3xl text-center font-extrabold text-gray-900">
              Sign in
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-12 pb-12">
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

              <Button
                type="submit"
                className="w-full h-14 text-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all transform active:scale-[0.98]"
              >
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
