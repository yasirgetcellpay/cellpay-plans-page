import { useState, useEffect } from "react";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Mail, Shield, Lock, Eye, EyeOff, Phone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callProxy, fetchUserProfile } from "@/services/apiWrapper";

interface ProfileData {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  active?: boolean;
  verified?: boolean;
  user_type?: string;
  [key: string]: unknown;
}

const Profile = () => {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    const load = async () => {
      try {
        const data = await fetchUserProfile();
        setProfile(data as ProfileData);
      } catch {
        // Fallback to local user data
        if (user) {
          setProfile({
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            active: user.active,
            verified: user.verified,
            user_type: user.user_type,
          });
        }
      } finally {
        setLoadingProfile(false);
      }
    };
    load();
  }, [isLoggedIn, navigate, user]);

  if (!isLoggedIn) return null;

  const displayProfile = profile || user;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await callProxy({
        endpoint: "auth/change-password",
        method: "POST",
        payload: { current_password: currentPassword, new_password: newPassword },
      });
      toast({ title: "Success", description: "Password changed successfully." });
      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Error", description: "Failed to change password. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-20 items-center">
            <BackButton />
            <span className="text-xl sm:text-2xl font-extrabold text-cellpay-green tracking-tight">CellPay</span>
            <AccountDropdown />
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>

        {loadingProfile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground text-sm">Loading profile...</span>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {(displayProfile as ProfileData)?.first_name} {(displayProfile as ProfileData)?.last_name}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {(displayProfile as ProfileData)?.user_type || "Customer"}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{(displayProfile as ProfileData)?.email}</p>
              </div>
            </div>

            {(displayProfile as ProfileData)?.phone && (
              <div className="px-5 py-4 flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium text-foreground">{(displayProfile as ProfileData)?.phone}</p>
                </div>
              </div>
            )}

            <div className="px-5 py-4 flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <p className="text-sm font-medium text-foreground">
                  {(displayProfile as ProfileData)?.verified ? "Verified" : "Unverified"} · {(displayProfile as ProfileData)?.active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>

            <div className="px-5 py-4">
              <button
                onClick={() => setShowChangePassword((p) => !p)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline transition-colors"
              >
                <Lock className="h-4 w-4" />
                Change Password
              </button>

              {showChangePassword && (
                <form onSubmit={handleChangePassword} className="mt-4 space-y-3 max-w-sm">
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button type="button" onClick={() => setShowCurrent((p) => !p)} className="absolute right-2 top-2 text-muted-foreground">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button type="button" onClick={() => setShowNew((p) => !p)} className="absolute right-2 top-2 text-muted-foreground">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Saving..." : "Update Password"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                      className="px-4 py-2 bg-muted text-muted-foreground text-sm font-medium rounded-md hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Profile;
