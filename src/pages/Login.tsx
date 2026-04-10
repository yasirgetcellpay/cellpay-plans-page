import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { loginUser } from "@/services/apiWrapper";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const result = await loginUser(email, password);
      if (result.success && result.data) {
        const authData = (result.data as any).data ?? result.data;
        if (authData?.token && authData?.user) {
          login(authData.token, authData.user);
          toast.success("Login successful!");
          navigate("/");
        } else {
          toast.error((result.data as any).message || "Login failed");
        }
      } else {
        toast.error(result.error || "Login failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      {/* Hero banner */}
      <div
        className="relative py-10 sm:py-16 text-center"
        style={{
          background: "linear-gradient(135deg, hsl(0 72% 55% / 0.85), hsl(15 80% 55% / 0.75))",
        }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
          Login to Your Account
        </h1>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-lg space-y-5"
        >
          <Input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 text-base rounded-lg border-border"
            required
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-base rounded-lg border-border pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-lg font-semibold rounded-full"
            style={{
              background: "linear-gradient(135deg, hsl(15 80% 55%), hsl(30 90% 55%))",
            }}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Signin
          </Button>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Forgot password?</span>
            <Link to="#" className="text-primary font-medium hover:underline">
              Reset
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-4">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Register
            </Link>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
