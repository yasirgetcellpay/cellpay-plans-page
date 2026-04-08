import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CheckoutPayload } from "@/lib/cellpay-api";

interface CheckoutResult {
  success: boolean;
  data?: {
    status?: boolean;
    message?: string;
    transactionId?: string;
    HostedURL?: string;
  };
}

export const useCheckout = () => {
  const [processing, setProcessing] = useState(false);

  const processCheckout = async (payload: CheckoutPayload): Promise<CheckoutResult> => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "cellpay-proxy?action=checkout",
        { body: payload }
      );

      if (error) throw error;

      const result = data as CheckoutResult;
      if (result?.data?.HostedURL) {
        window.location.href = result.data.HostedURL;
      } else if (result?.data?.transactionId) {
        toast.success(`Payment successful! Transaction: ${result.data.transactionId}`);
      }

      return result;
    } catch (err) {
      console.error("Checkout failed:", err);
      toast.error("Payment failed. Please try again.");
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  return { processCheckout, processing };
};
