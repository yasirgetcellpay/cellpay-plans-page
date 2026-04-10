import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { loginUser, registerUser } from "@/services/apiWrapper";
import { toast } from "sonner";

interface AuthDialogsProps {
  mode: "login" | "register" | null;
  onClose: () => void;
  onSwitchMode: (mode: "login" | "register") => void;
}

export const AuthDialogs = ({ mode, onClose, onSwitchMode }: AuthDialogsProps) => {
  return (
    <>
      <Dialog open={mode === "login"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
          <LoginForm onClose={onClose} onSwitchToRegister={() => onSwitchMode("register")} />
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "register"} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
          <RegisterForm onClose={onClose} onSwitchToLogin={() => onSwitchMode("login")} />
        </DialogContent>
      </Dialog>
    </>
  );
};

function LoginForm({ onClose, onSwitchToRegister }: { onClose: () => void; onSwitchToRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

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
          onClose();
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
    <div className="p-6 sm:p-8">
      <DialogHeader className="mb-6">
        <DialogTitle className="text-2xl font-bold text-center">Login</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 text-base rounded border-border"
          required
        />
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base rounded border-border pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 text-base font-semibold rounded"
          style={{ background: "hsl(0 72% 55%)" }}
        >
          {loading ? <Loader2 className="animate-spin mr-2" /> : null}
          LOGIN
        </Button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Forgot password?</span>
          <button type="button" className="text-destructive font-medium hover:underline">
            Reset
          </button>
        </div>

        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-destructive font-semibold hover:underline"
          >
            Register
          </button>
        </div>
      </form>
    </div>
  );
}

function RegisterForm({ onClose, onSwitchToLogin }: { onClose: () => void; onSwitchToLogin: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await registerUser({ email, password, first_name: firstName, last_name: lastName });
      if (result.success && result.data) {
        const authData = (result.data as any).data ?? result.data;
        if (authData?.token && authData?.user) {
          login(authData.token, authData.user);
          toast.success("Registration successful!");
          onClose();
        } else {
          toast.error((result.data as any).message || "Registration failed");
        }
      } else {
        toast.error(result.error || "Registration failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <DialogHeader className="mb-6">
        <DialogTitle className="text-2xl font-bold text-center">Register</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="h-12 text-base rounded border-border"
          required
        />
        <Input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="h-12 text-base rounded border-border"
          required
        />
        <Input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 text-base rounded border-border"
          required
        />
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base rounded border-border pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 text-base font-semibold rounded"
          style={{ background: "hsl(0 72% 55%)" }}
        >
          {loading ? <Loader2 className="animate-spin mr-2" /> : null}
          REGISTER
        </Button>

        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          By signing up you agree with our{" "}
          <a href="#" className="text-destructive hover:underline">Terms and Conditions</a>{" "}
          and{" "}
          <a href="#" className="text-destructive hover:underline">Privacy Statement</a>.
        </div>

        <div className="text-center text-sm font-bold text-foreground">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-destructive font-semibold hover:underline"
          >
            Login
          </button>
        </div>
      </form>
    </div>
  );
}
