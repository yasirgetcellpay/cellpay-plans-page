import { useState, useEffect } from "react";
import { BackButton } from "@/components/BackButton";
import { AccountDropdown } from "@/components/AccountDropdown";
import { Footer } from "@/components/Footer";
import { PaymentBar } from "@/components/PaymentBar";
import { LegalBar } from "@/components/LegalBar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Mail, Shield, Lock, Eye, EyeOff, Phone, Loader2, Pencil, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchUserProfile, updateUserProfile } from "@/services/apiWrapper";

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
  const { user, isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Edit name
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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

  const p = profile || (user as ProfileData | null);

  const startEditing = () => {
    setFirstName(p?.first_name || "");
    setLastName(p?.last_name || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFirstName("");
    setLastName("");
  };

  const handleSaveName = async () => {
    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();
    if (!trimFirst || !trimLast) {
      toast({ title: "Error", description: "First and last name are required.", variant: "destructive" });
      return;
    }
    if (trimFirst.length > 100 || trimLast.length > 100) {
      toast({ title: "Error", description: "Name must be under 100 characters.", variant: "destructive" });
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateUserProfile({ first_name: trimFirst, last_name: trimLast });
      setProfile((prev) => ({ ...prev, ...updated, first_name: trimFirst, last_name: trimLast }));
      // Update auth context so navbar reflects new name
      if (user) {
        const token = localStorage.getItem("cellpay_token");
        if (token) login(token, { ...user, first_name: trimFirst, last_name: trimLast });
      }
      toast({ title: "Success", description: "Profile updated." });
      setEditing(false);
    } catch {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await updateUserProfile({ password: newPassword, confirm_password: confirmPassword });
      toast({ title: "Success", description: "Password changed successfully." });
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Error", description: "Failed to change password.", variant: "destructive" });
    } finally {
      setSavingPassword(false);
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
            {/* Name */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              {editing ? (
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    maxLength={100}
                    className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    maxLength={100}
                    className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-1">
                    <button onClick={handleSaveName} disabled={savingName} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button onClick={cancelEditing} className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{p?.first_name} {p?.last_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{p?.user_type || "Customer"}</p>
                  </div>
                  <button onClick={startEditing} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Edit name">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="px-5 py-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{p?.email}</p>
              </div>
            </div>

            {/* Phone */}
            {p?.phone && (
              <div className="px-5 py-4 flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium text-foreground">{p.phone}</p>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="px-5 py-4 flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <p className="text-sm font-medium text-foreground">
                  {p?.verified ? "Verified" : "Unverified"} · {p?.active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>

            {/* Change Password */}
            <div className="px-5 py-4">
              <button
                onClick={() => setShowChangePassword((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline transition-colors"
              >
                <Lock className="h-4 w-4" />
                Change Password
              </button>

              {showChangePassword && (
                <form onSubmit={handleChangePassword} className="mt-4 space-y-3 max-w-sm">
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-2 text-muted-foreground">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingPassword} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {savingPassword ? "Saving..." : "Update Password"}
                    </button>
                    <button type="button" onClick={() => { setShowChangePassword(false); setNewPassword(""); setConfirmPassword(""); }} className="px-4 py-2 bg-muted text-muted-foreground text-sm font-medium rounded-md hover:bg-muted/80 transition-colors">
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
