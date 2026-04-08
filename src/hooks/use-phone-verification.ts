import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VerifyResult {
  success: boolean;
  message?: string;
}

export const usePhoneVerification = () => {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const verify = async (slug: string, phoneNumber: string, planId?: string, amount?: number) => {
    setVerifying(true);
    setVerified(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        `cellpay-proxy?action=verify-phone&slug=${encodeURIComponent(slug)}`,
        {
          body: {
            phone_number: phoneNumber,
            confirm_phone_number: phoneNumber,
            ...(planId ? { plan_id: planId } : {}),
            ...(amount ? { amount } : {}),
          },
        }
      );

      if (error) throw error;

      const result = data as VerifyResult;
      setVerified(result.success !== false);
      if (result.message) {
        toast[result.success !== false ? "success" : "error"](result.message);
      }
      return result;
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
