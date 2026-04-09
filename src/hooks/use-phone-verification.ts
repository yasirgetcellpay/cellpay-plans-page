import { useState } from "react";
import { verifyPhone as verifyPhoneRequest } from "@/services/apiWrapper";
import { toast } from "sonner";

interface VerifyResult {
  success?: boolean;
  message?: string;
}

export const usePhoneVerification = () => {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const verify = async (slug: string, phoneNumber: string, planId?: string, amount?: number) => {
    setVerifying(true);
    setVerified(null);

    try {
      const result = await verifyPhoneRequest<VerifyResult>(
        slug,
        phoneNumber,
        planId,
        amount,
      );

      if (!result.success || !result.data) {
        const message = result.error || "Phone verification failed. Please try again.";
        toast.error(message);
        setVerified(false);
        return { success: false, message };
      }

      const payload = result.data;
      const isSuccess = payload.success !== false;
      setVerified(isSuccess);

      if (payload.message) {
        toast[isSuccess ? "success" : "error"](payload.message);
      }

      return payload;
    } catch (err) {
      console.error("Phone verification failed:", err);
      toast.error("Phone verification failed. Please try again.");
      setVerified(false);
      return { success: false };
    } finally {
      setVerifying(false);
    }
  };

  return { verify, verifying, verified };
};
