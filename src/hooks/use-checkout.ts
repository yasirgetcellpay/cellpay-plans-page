import { useState } from "react";
import { processCheckout as processCheckoutRequest, type CheckoutPayload } from "@/services/apiWrapper";
import { toast } from "sonner";

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
      const result = await processCheckoutRequest<CheckoutResult>(payload);

      if (!result.success || !result.data) {
        toast.error(result.error || "Payment failed. Please try again.");
        return { success: false };
      }

      const checkoutResult = result.data;

      if (checkoutResult?.data?.HostedURL) {
        window.location.href = checkoutResult.data.HostedURL;
      } else if (checkoutResult?.data?.transactionId) {
        toast.success(`Payment successful! Transaction: ${checkoutResult.data.transactionId}`);
      }

      return checkoutResult;
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
