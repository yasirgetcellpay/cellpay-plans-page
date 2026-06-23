import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/contexts/AuthContext";
import { setSeoHead } from "@/lib/seo";

interface Props {
  mode?: "login" | "register";
}

export default function Login({ mode = "login" }: Props) {
  const [open, setOpen] = useState(true);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSeoHead({
      title: mode === "register" ? "Create Account | CellPay" : "Log In | CellPay",
      description:
        mode === "register"
          ? "Create your CellPay account to manage prepaid recharges and orders."
          : "Log in to your CellPay account to manage prepaid recharges and order history.",
    });
  }, [mode]);

  useEffect(() => {
    if (isLoggedIn) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get("redirect") || "/profile";
      navigate(redirect, { replace: true });
    }
  }, [isLoggedIn, navigate, location.search]);

  // If user closes the dialog, send them home
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {mode === "register" ? "Create your account" : "Log in to CellPay"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "register"
              ? "Sign up to track orders and recharge faster next time."
              : "Sign in to manage your recharges and view order history."}
          </p>
        </div>
      </main>
      <Footer />
      <AuthDialog open={open} onOpenChange={handleOpenChange} initialMode={mode} />
    </div>
  );
}
