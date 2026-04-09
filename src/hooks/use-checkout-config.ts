import { useState, useEffect } from "react";
import { fetchCheckoutClientConfig } from "@/services/apiWrapper";

export interface CheckoutClientConfig {
  api?: {
    payments?: {
      applePaySession?: string;
      plaidLinkToken?: string;
      plaidExchangeToken?: string;
      paypalCreateOrder?: string;
      paypalCaptureOrder?: string;
      klarnaSession?: string;
      checkoutTransaction?: string;
    };
  };
  paypal?: { clientId?: string };
  googlePay?: { merchantId?: string; gatewayMerchantId?: string; environment?: string };
  plaid?: { linkInitializeScriptUrl?: string };
  [key: string]: unknown;
}

export const useCheckoutConfig = () => {
  const [config, setConfig] = useState<CheckoutClientConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchCheckoutClientConfig<CheckoutClientConfig>();
        if (cancelled) return;
        if (result.success && result.data) {
          // The upstream may nest data inside a `data` property
          const d = (result.data as any)?.data ?? result.data;
          setConfig(d);
        } else {
          setError(result.error || "Failed to load checkout configuration");
        }
      } catch {
        if (!cancelled) setError("Failed to load checkout configuration");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { config, loading, error };
};
