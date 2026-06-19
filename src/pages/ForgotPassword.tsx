import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { applySeoHead } from "@/lib/seo";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    applySeoHead({
      title: "Forgot Password? Reset Your CellPay Login | CellPay",
      description:
        "Reset your CellPay password. Enter your account email and we'll send you a secure link to set a new password.",
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      // Try the backend forgot-password endpoint via the CellPay proxy.
      // The proxy returns whatever the upstream API responds with; we always
      // show a generic success message to avoid leaking which emails exist.
      await supabase.functions.invoke("cellpay-proxy", {
        body: {
          endpoint: "users/forgot-password",
          method: "POST",
          payload: { email: trimmed },
        },
      });
    } catch {
      // Swallow errors — we still show a generic success message.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <Link
              to="/"
              className="text-xl sm:text-2xl font-extrabold text-cellpay-green tracking-tight"
            >
              CellPay
            </Link>
            <AccountDropdown />
          </div>
        </div>
      </nav>

      {/* Hero banner */}
      <header className="bg-gradient-to-r from-cellpay-green/90 to-cellpay-green text-white">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/15 mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Forgot Password? Reset Your CellPay Login
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/90 max-w-xl mx-auto">
            Enter the email address associated with your account and we'll send you a secure link to reset your password.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-10 sm:py-14">
        {submitted ? (
          <div className="bg-card border border-border rounded-lg shadow-sm p-6 sm:p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, you'll receive a password reset link shortly. Please check your inbox and spam folder.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
              >
                Send to a different email
              </Button>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-cellpay-green hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-lg shadow-sm p-6 sm:p-8 space-y-5"
            aria-labelledby="forgot-form-heading"
          >
            <h2 id="forgot-form-heading" className="sr-only">Reset password form</h2>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-cellpay-green text-white hover:bg-cellpay-green/90 font-semibold h-11 rounded-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending..." : "Submit"}
            </Button>

            <div className="pt-4 border-t border-border">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-cellpay-green transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </div>
          </form>
        )}
      </main>

      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default ForgotPassword;
