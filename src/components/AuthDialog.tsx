import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "register";
}

async function callAuthProxy(endpoint: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("cellpay-proxy", {
    body: { endpoint, method: "POST", payload },
  });
  if (error) throw new Error(error.message || "Request failed");
  return data as Record<string, unknown>;
}

export function AuthDialog({ open, onOpenChange, initialMode = "login" }: Props) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Sync mode when initialMode or open changes
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const reset = () => {
    setEmail(""); setPassword(""); setFirstName(""); setLastName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await callAuthProxy("users/login", { email, password });
        const d = (res.data || res) as Record<string, unknown>;
        // Handle nested data
        const inner = (d.data || d) as Record<string, unknown>;
        const token = inner.token as string;
        const user = inner.user as Record<string, unknown>;
        if (!token) throw new Error((inner.message as string) || "Login failed");
        login(token, {
          id: user.id as number,
          email: user.email as string,
          first_name: user.first_name as string,
          last_name: user.last_name as string,
          active: user.active as boolean,
          verified: user.verified as boolean,
          user_type: user.user_type as string,
        });
        toast({ title: "Welcome back!", description: `Logged in as ${user.email}` });
        reset();
        onOpenChange(false);
      } else {
        await callAuthProxy("users/register", { email, password, first_name: firstName, last_name: lastName });
        toast({ title: "Account created!", description: "You can now log in." });
        setMode("login");
        setPassword("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {mode === "login" ? "Log In" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your account to manage recharges."
              : "Create a new account to get started."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          )}
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Log In" : "Sign Up"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-2">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-primary font-semibold hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary font-semibold hover:underline"
              >
                Log In
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
