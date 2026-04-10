import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialogs } from "@/components/AuthDialogs";
import cellpayLogo from "@/assets/cellpay-logo.webp";
import { useCheckout } from "@/hooks/use-checkout";
import { useCheckoutConfig } from "@/hooks/use-checkout-config";
import { useCarrierData } from "@/hooks/use-carrier-data";
import {
  exchangePlaidToken,
  createPaypalOrder,
  capturePaypalOrder,
  createPlaidLinkToken,
} from "@/services/apiWrapper";
import { PaymentBar } from "@/components/PaymentBar";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CheckoutState {
  phone: string;
  amount: number;
  fee: number;
  tax: number;
  total: number;
  planId: string;
  carrierId: number;
  carrierName: string;
  carrierSlug: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const DEFAULT_PROCESSING_FEE = 5.99;
const NAV_COLOR = "#2d3748";
const ACCENT_GREEN = "hsl(101, 67%, 44%)";
const ACCENT_GREEN_HOVER = "hsl(101, 67%, 38%)";

const paymentMethods = [
  { id: "cardpayment", label: "Credit Card", icon: "💳" },
  { id: "plaid", label: "Pay by Bank", subtitle: "Instant Login, No Manual Entry", icon: "⚙️" },
  { id: "paypal", label: "Paypal", icon: "🅿️" },
  { id: "googlepay", label: "Google Pay", icon: "G" },
  { id: "applepay", label: " Pay", icon: "apple" },
  { id: "pockyt", label: "Cash App Pay", icon: "💲" },
  { id: "klarna", label: "Klarna", subtitle: "(Buy now, pay later)", icon: "K" },
];

const getPaymentMethodLabel = (id: string) =>
  paymentMethods.find((pm) => pm.id === id)?.label || "credit card";

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CheckoutState | null;
  const { processCheckout, processing } = useCheckout();
  const { config, loading: configLoading } = useCheckoutConfig();
  const { range: carrierRange } = useCarrierData(state?.carrierSlug || "", []);

  const [paymentMethod, setPaymentMethod] = useState<string>("cardpayment");
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const { isAuthenticated, logout } = useAuth();
  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "", billingPhone: "",
    address: "", city: "", stateProvince: "", zip: "",
    ccNumber: "", expMonth: "", expYear: "", cvv: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [savePayment, setSavePayment] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Plaid state
  const [plaidBankName, setPlaidBankName] = useState<string | null>(null);
  const [plaidAccessToken, setPlaidAccessToken] = useState<string | null>(null);
  const [plaidProcessing, setPlaidProcessing] = useState(false);
  const [plaidScriptLoaded, setPlaidScriptLoaded] = useState(false);

  // PayPal state
  const [paypalProcessing, setPaypalProcessing] = useState(false);
  const [paypalScriptLoaded, setPaypalScriptLoaded] = useState(false);

  // Google Pay state
  const [gpayProcessing, setGpayProcessing] = useState(false);
  const [gpayReady, setGpayReady] = useState(false);
  const [gpayScriptLoaded, setGpayScriptLoaded] = useState(false);

  // Generic processing for apple/klarna/pockyt
  const [methodProcessing, setMethodProcessing] = useState(false);

  // Error dialog
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });

  // Success dialog
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; transactionId: string }>({ open: false, transactionId: "" });

  // Load Plaid script dynamically
  useEffect(() => {
    if (paymentMethod !== "plaid" || plaidScriptLoaded) return;
    const scriptUrl = config?.plaid?.linkInitializeScriptUrl || "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    if (document.querySelector(`script[src="${scriptUrl}"]`)) {
      setPlaidScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.onload = () => setPlaidScriptLoaded(true);
    document.head.appendChild(script);
  }, [paymentMethod, config, plaidScriptLoaded]);

  // Load PayPal SDK dynamically
  useEffect(() => {
    if (paymentMethod !== "paypal" || paypalScriptLoaded) return;
    const clientId = config?.paypal?.clientId;
    if (!clientId) return;
    const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    if (document.querySelector(`script[src*="paypal.com/sdk/js"]`)) {
      setPaypalScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = sdkUrl;
    script.onload = () => setPaypalScriptLoaded(true);
    document.head.appendChild(script);
  }, [paymentMethod, config, paypalScriptLoaded]);

  // Load Google Pay SDK dynamically
  useEffect(() => {
    if (paymentMethod !== "googlepay" || gpayScriptLoaded) return;
    if ((window as any).google?.payments?.api?.PaymentsClient) {
      setGpayScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://pay.google.com/gp/p/js/pay.js";
    script.onload = () => setGpayScriptLoaded(true);
    document.head.appendChild(script);
  }, [paymentMethod, gpayScriptLoaded]);

  // Check Google Pay readiness
  useEffect(() => {
    if (!gpayScriptLoaded || !(window as any).google?.payments?.api?.PaymentsClient) return;
    const env = config?.googlePay?.environment || "TEST";
    const client = new (window as any).google.payments.api.PaymentsClient({ environment: env });
    client.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{
        type: "CARD",
        parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] },
      }],
    }).then((res: any) => {
      setGpayReady(!!res.result);
    }).catch(() => setGpayReady(false));
  }, [gpayScriptLoaded, config]);


    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No order information found.</p>
          <Link to="/" className="text-blue-600 underline">Go back home</Link>
        </div>
      </div>
    );
  }

  const { phone, amount, fee, tax, total: stateTotal, planId, carrierId, carrierName, carrierSlug } = state;
  const processingFee = fee ?? DEFAULT_PROCESSING_FEE;
  const totalTax = tax ?? 0;
  const total = stateTotal ?? (amount + processingFee + totalTax);
  const resolvedPlanId = planId || carrierRange?.planId || "";
  const hasResolvedPlanId = !!resolvedPlanId;
  const pmLabel = getPaymentMethodLabel(paymentMethod).toLowerCase();

  // --- Formatting ---
  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };
  const formatZip = (val: string) => val.replace(/\D/g, "").slice(0, 5);
  const formatCvv = (val: string) => val.replace(/\D/g, "").slice(0, 4);
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    if (field === "ccNumber") value = formatCardNumber(value);
    else if (field === "zip") value = formatZip(value);
    else if (field === "cvv") value = formatCvv(value);
    else if (field === "billingPhone") value = formatPhone(value);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  // --- Validation ---
  const ccDigits = form.ccNumber.replace(/\s/g, "");
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const isCardLengthValid = ccDigits.length >= 13 && ccDigits.length <= 16;
  const isLuhnValid = (() => {
    if (ccDigits.length < 13) return false;
    let sum = 0;
    for (let i = 0; i < ccDigits.length; i++) {
      let d = parseInt(ccDigits[ccDigits.length - 1 - i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  })();
  const isCardValid = isCardLengthValid && isLuhnValid;
  const isCvvValid = form.cvv.length >= 3 && form.cvv.length <= 4;
  const isExpValid = !!(form.expMonth && form.expYear) && (() => {
    const now = new Date();
    const expDate = new Date(parseInt(form.expYear), parseInt(form.expMonth), 0);
    return expDate >= new Date(now.getFullYear(), now.getMonth(), 1);
  })();
  const isZipValid = form.zip.length === 5;

  const fieldError = (field: string, valid: boolean, msg: string) =>
    touched[field] && !valid ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;

  const needsBillingForm = paymentMethod === "cardpayment";
  const isFormValid =
    hasResolvedPlanId &&
    form.email && isValidEmail && agreeTerms &&
    (needsBillingForm
      ? form.firstName && form.lastName && form.billingPhone && form.address && form.city && form.stateProvince && isZipValid && isCardValid && isExpValid && isCvvValid
      : paymentMethod === "plaid" ? !!plaidAccessToken : true);

  const detectCardType = (num: string): string => {
    const d = num.replace(/\D/g, "");
    if (/^4/.test(d)) return "visa";
    if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5)/.test(d)) return "discover";
    return "visa";
  };

  const buildBasePayload = () => ({
    amount,
    total,
    phone_number: phone,
    carrierId,
    plan_id: resolvedPlanId,
    slug: carrierSlug,
    agree_desktop: true,
    payment: {
      firstName: form.firstName || "Customer",
      lastName: form.lastName || "",
      email: form.email,
    },
  });

  const buildPayload = (): import("@/services/apiWrapper").CheckoutPayload => {
    const base = buildBasePayload();
    switch (paymentMethod) {
      case "cardpayment":
        return {
          ...base,
          payment_method: "cardpayment",
          payment: {
            ...base.payment,
            address: form.address,
            city: form.city,
            zip: form.zip,
            cc_type: detectCardType(form.ccNumber),
            cc_number: form.ccNumber.replace(/\s/g, ""),
            cc_exp_month: form.expMonth,
            cc_exp_year: form.expYear,
            cvv_number: form.cvv,
          },
          billing: {
            bill_email: form.email,
            country_id: "US",
            region: form.stateProvince,
          },
        };
      case "plaid":
        return { ...base, payment_method: "plaid", ...(plaidAccessToken ? { plaid_token: plaidAccessToken } : {}) };
      case "paypal":
        return { ...base, payment_method: "paypal" };
      case "googlepay":
        return { ...base, payment_method: "googlepay" };
      case "applepay":
        return { ...base, payment_method: "applepay" };
      case "pockyt":
        return { ...base, payment_method: "pockyt" };
      case "klarna":
        return { ...base, payment_method: "klarna" as any };
      default:
        return { ...base, payment_method: "cardpayment" };
    }
  };

  // --- Handle successful checkout result ---
  const handleCheckoutResult = (result: any, methodName: string) => {
    const data = result?.data?.data ?? result?.data;
    if (data?.HostedURL) {
      window.location.href = data.HostedURL;
    } else if (result?.success && data?.status !== false) {
      const txId = data?.transactionId || "";
      setSuccessDialog({ open: true, transactionId: txId });
    } else {
      const apiMsg = data?.msg || data?.message || result?.error || "";
      setErrorDialog({
        open: true,
        title: "Payment Failed",
        message: apiMsg || `${methodName} payment could not be completed. Please try again or contact support.`,
      });
    }
  };

  // --- PLAID handler ---
  const handlePlaidConnect = async () => {
    if (!(window as any).Plaid) {
      toast.error("Plaid is not loaded yet. Please wait.");
      return;
    }
    if (!form.email || !isValidEmail) {
      setTouched((prev) => ({ ...prev, email: true }));
      toast.error("Please enter a valid email address before connecting your bank.");
      return;
    }
    if (!form.firstName || !form.lastName) {
      toast.error("Please enter your first and last name in the contact section.");
      return;
    }
    setPlaidProcessing(true);
    try {
      // Get link token from CellPay backend with customer phone number
      let linkToken: string | null = null;

      const linkResult = await createPlaidLinkToken<any>({ phone_number: phone });
      const linkData = linkResult.data?.data ?? linkResult.data;
      linkToken = linkData?.link_token || null;

      // Fallback: use our own Plaid edge function if upstream fails
      if (!linkToken) {
        console.warn("CellPay plaid-link-token failed, falling back to own edge function");
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: fallbackData } = await supabase.functions.invoke("plaid-link-token", {
          body: { phone_number: phone },
        });
        linkToken = fallbackData?.link_token || null;
      }

      if (!linkToken) throw new Error("Could not get Plaid link token");

      const handler = (window as any).Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken: string, metadata: any) => {
          const bankName = metadata?.institution?.name || "Bank account";
          setPlaidBankName(bankName);
          toast.info(`Connected to ${bankName}. Exchanging token...`);

          try {
            // Exchange public_token for access_token via CellPay API
            let tokenForCheckout = publicToken;
            try {
              const exchangeResult = await exchangePlaidToken<any>({
                public_token: publicToken,
                metadata: metadata || {},
                connected_account: metadata?.institution?.institution_id || "",
                carrierId,
                plan_id: resolvedPlanId,
                phone_number: phone,
                amount: amount,
              });
              const exchangeData = exchangeResult.data?.data ?? exchangeResult.data;
              const accessToken = exchangeData?.access_token;
              if (accessToken) {
                tokenForCheckout = accessToken;
              } else {
                console.warn("Token exchange didn't return access_token, using public_token for checkout");
              }
            } catch (exchangeErr) {
              console.warn("Token exchange failed, using public_token for checkout:", exchangeErr);
            }

            setPlaidAccessToken(tokenForCheckout);

            // Auto-checkout
            const payload = buildPayload();
            payload.plaid_token = tokenForCheckout;
            payload.payment_method = "plaid";
            const result = await processCheckout(payload);
            handleCheckoutResult(result, "Pay by Bank");
          } catch (err) {
            console.error("Plaid exchange/checkout error:", err);
            setErrorDialog({
              open: true,
              title: "Payment Error",
              message: "Bank connection succeeded but payment processing failed. Please try again.",
            });
          } finally {
            setPlaidProcessing(false);
          }
        },
        onExit: (err: any) => {
          setPlaidProcessing(false);
          if (err) {
            setErrorDialog({
              open: true,
              title: "Bank Connection Failed",
              message: err.display_message || err.error_message || "Could not connect to your bank.",
            });
          }
        },
      });
      handler.open();
    } catch (err) {
      console.error("Plaid error:", err);
      setPlaidProcessing(false);
      setErrorDialog({
        open: true,
        title: "Connection Error",
        message: "Could not initialize bank connection. Please try again.",
      });
    }
  };

  // --- PAYPAL checkout handler (triggered by Place Order Now) ---
  const handlePaypalCheckout = async () => {
    if (!(window as any).paypal) {
      toast.error("PayPal SDK not loaded yet. Please wait.");
      return;
    }
    setPaypalProcessing(true);
    try {
      // Create order
      const res = await createPaypalOrder<any>({ amount: total, currency: "USD", carrierId, plan_id: resolvedPlanId, phone_number: phone, description: `${carrierName} refill - ${phone}` });
      const orderData = res.data?.data ?? res.data;
      const orderId = orderData?.id || orderData?.orderID;
      if (!orderId) throw new Error("Could not create PayPal order.");

      // Redirect to PayPal approval URL if available, otherwise use SDK popup
      const approvalUrl = orderData?.links?.find((l: any) => l.rel === "approve")?.href;
      if (approvalUrl) {
        window.location.href = approvalUrl;
        return;
      }

      // Fallback: use PayPal SDK buttons popup
      const paypal = (window as any).paypal;
      await new Promise<void>((resolve, reject) => {
        const tempDiv = document.createElement("div");
        tempDiv.style.display = "none";
        document.body.appendChild(tempDiv);
        paypal.Buttons({
          createOrder: () => orderId,
          onApprove: async (data: any) => {
            try {
              await capturePaypalOrder<any>({ orderID: data.orderID });
              const payload = buildPayload();
              const result = await processCheckout(payload);
              handleCheckoutResult(result, "PayPal");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          onCancel: () => {
            setErrorDialog({ open: true, title: "Payment Cancelled", message: "You cancelled the PayPal payment." });
            resolve();
          },
          onError: (err: any) => reject(err),
        }).render(tempDiv);
      });
    } catch (err) {
      console.error("PayPal error:", err);
      setErrorDialog({ open: true, title: "PayPal Error", message: "Could not process PayPal payment. Please try again." });
    } finally {
      setPaypalProcessing(false);
    }
  };

  // --- GOOGLE PAY handler ---
  const handleGooglePay = async () => {
    const merchantId = config?.googlePay?.merchantId;
    const gatewayMerchantId = config?.googlePay?.gatewayMerchantId;
    const env = config?.googlePay?.environment || "TEST";

    if (!merchantId) {
      toast.error("Google Pay is not configured.");
      return;
    }

    setGpayProcessing(true);
    try {
      const paymentsClient = new (window as any).google.payments.api.PaymentsClient({ environment: env });
      const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: "CARD",
          parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] },
          tokenizationSpecification: { type: "PAYMENT_GATEWAY", parameters: { gateway: "example", gatewayMerchantId } },
        }],
        merchantInfo: { merchantId, merchantName: "CellPay" },
        transactionInfo: { totalPriceStatus: "FINAL", totalPrice: total.toFixed(2), currencyCode: "USD" },
      };

      const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
      const token = paymentData?.paymentMethodData?.tokenizationData?.token;

      const payload = buildPayload();
      (payload as any).google_pay_token = token;
      payload.payment_method = "googlepay";
      const result = await processCheckout(payload);
      handleCheckoutResult(result, "Google Pay");
    } catch (err: any) {
      if (err?.statusCode === "CANCELED") {
        setErrorDialog({ open: true, title: "Payment Cancelled", message: "Google Pay was cancelled." });
      } else {
        console.error("Google Pay error:", err);
        setErrorDialog({ open: true, title: "Google Pay Error", message: "Could not process Google Pay. Please try another method." });
      }
    } finally {
      setGpayProcessing(false);
    }
  };

  // --- APPLE PAY handler ---
  const handleApplePay = async () => {
    if (!(window as any).ApplePaySession) {
      setErrorDialog({ open: true, title: "Apple Pay Unavailable", message: "Apple Pay is not supported on this device/browser." });
      return;
    }

    setMethodProcessing(true);
    try {
      const request = {
        countryCode: "US",
        currencyCode: "USD",
        supportedNetworks: ["visa", "masterCard", "amex", "discover"],
        merchantCapabilities: ["supports3DS"],
        total: { label: "CellPay Refill", amount: total.toFixed(2) },
      };
      const session = new (window as any).ApplePaySession(3, request);

      session.onvalidatemerchant = async (event: any) => {
        try {
          const res = await fetch(
            `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cellpay-proxy?action=apple-pay-session`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
              body: JSON.stringify({ validationURL: event.validationURL }),
            }
          );
          const merchantSession = await res.json();
          session.completeMerchantValidation(merchantSession.data ?? merchantSession);
        } catch (err) {
          console.error("Apple Pay validation error:", err);
          session.abort();
        }
      };

      session.onpaymentauthorized = async (event: any) => {
        try {
          const token = JSON.stringify(event.payment.token);
          const payload = buildPayload();
          (payload as any).apple_pay_token = token;
          payload.payment_method = "applepay";
          const result = await processCheckout(payload);
          const success = result?.success || result?.data?.status;
          session.completePayment(success ? (window as any).ApplePaySession.STATUS_SUCCESS : (window as any).ApplePaySession.STATUS_FAILURE);
          if (success) handleCheckoutResult(result, "Apple Pay");
          else setErrorDialog({ open: true, title: "Payment Failed", message: "Apple Pay payment could not be completed." });
        } catch {
          session.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
          setErrorDialog({ open: true, title: "Payment Error", message: "Apple Pay processing failed." });
        }
      };

      session.oncancel = () => {
        setErrorDialog({ open: true, title: "Payment Cancelled", message: "Apple Pay was cancelled." });
      };

      session.begin();
    } catch (err) {
      console.error("Apple Pay error:", err);
      setErrorDialog({ open: true, title: "Apple Pay Error", message: "Could not start Apple Pay." });
    } finally {
      setMethodProcessing(false);
    }
  };

  // --- POCKYT (Cash App Pay) handler ---
  const handlePockyt = async () => {
    setMethodProcessing(true);
    try {
      const payload = buildPayload();
      payload.payment_method = "pockyt";
      const result = await processCheckout(payload);
      handleCheckoutResult(result, "Cash App Pay");
    } catch (err) {
      console.error("Pockyt error:", err);
      setErrorDialog({ open: true, title: "Payment Error", message: "Cash App Pay failed. Please try again." });
    } finally {
      setMethodProcessing(false);
    }
  };

  // --- KLARNA handler ---
  const handleKlarna = async () => {
    setMethodProcessing(true);
    try {
      const payload = buildPayload();
      payload.payment_method = "klarna" as any;
      const result = await processCheckout(payload);
      handleCheckoutResult(result, "Klarna");
    } catch (err) {
      console.error("Klarna error:", err);
      setErrorDialog({ open: true, title: "Payment Error", message: "Klarna payment failed. Please try again." });
    } finally {
      setMethodProcessing(false);
    }
  };

  // --- Submit handler ---
  const handleSubmit = async () => {
    if (!isFormValid) {
      setTouched({ email: true, ccNumber: true, cvv: true, zip: true, expMonth: true, expYear: true });
      toast.error("Please fix the errors in the form.");
      return;
    }

    switch (paymentMethod) {
      case "plaid":
        return handlePlaidConnect();
      case "googlepay":
        return handleGooglePay();
      case "applepay":
        return handleApplePay();
      case "pockyt":
        return handlePockyt();
      case "klarna":
        return handleKlarna();
      case "paypal":
        return handlePaypalCheckout();
      case "cardpayment":
      default: {
        const payload = buildPayload();
        const result = await processCheckout(payload);
        handleCheckoutResult(result, "Credit Card");
      }
    }
  };

  const anyProcessing = processing || plaidProcessing || paypalProcessing || gpayProcessing || methodProcessing;

  const inputClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";
  const selectClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
      {/* Simple navbar — white bg, green bottom border */}
      <nav className="w-full bg-card border-b-4 border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex-shrink-0">
            <img src={cellpayLogo} alt="CellPay" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button onClick={logout} className="text-sm font-medium text-destructive hover:underline">Log Out</button>
            ) : (
              <>
                <button onClick={() => setAuthMode("login")} className="text-sm font-medium text-foreground hover:underline">Log In</button>
                <Link to="/" className="px-5 py-2 rounded text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">Recharge Now</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="text-white py-5" style={{ backgroundColor: ACCENT_GREEN }}>
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-2xl font-extrabold tracking-wide">Checkout</h1>
        </div>
      </div>

      {configLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading checkout...
        </div>
      )}

      {!configLoading && (
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Contact */}
              <section className="bg-white rounded border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4">Contact</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelClass}>First Name *</label>
                    <input type="text" value={form.firstName} onChange={handleChange("firstName")} placeholder="First Name..." className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name *</label>
                    <input type="text" value={form.lastName} onChange={handleChange("lastName")} placeholder="Last Name..." className={inputClass} />
                  </div>
                </div>
                <label className={labelClass}>Email *</label>
                <input type="email" value={form.email} onChange={handleChange("email")} onBlur={handleBlur("email")} placeholder="Enter Your Email..." className={`${inputClass} ${touched.email && !isValidEmail ? "border-red-400 ring-1 ring-red-400" : ""}`} />
                {fieldError("email", isValidEmail, "Please enter a valid email address.")}
                <label className="flex items-center gap-2 mt-3 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300" />
                  I am paying for someone else's account
                </label>
              </section>

              {/* Payment Options */}
              <section className="bg-white rounded border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4">Payment Options</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {paymentMethods.map((pm) => {
                    const isActive = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`flex items-center gap-3 py-4 px-4 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                          isActive ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {pm.icon === "apple" ? (
                          <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                        ) : (
                          <span className="text-2xl leading-none shrink-0">{pm.icon}</span>
                        )}
                        <div>
                          <span className="text-sm font-medium">{pm.label}</span>
                          {pm.subtitle && <span className="block text-[10px] text-gray-400 mt-0.5">{pm.subtitle}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* CREDIT CARD FORM */}
              {paymentMethod === "cardpayment" && (
                <section className="bg-white rounded border border-gray-200 p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Billing Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>First Name *</label>
                      <input type="text" value={form.firstName} onChange={handleChange("firstName")} placeholder="Enter Your First Name..." className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Last Name *</label>
                      <input type="text" value={form.lastName} onChange={handleChange("lastName")} placeholder="Enter Your Last Name..." className={inputClass} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>Bill Payer's Phone Number *</label>
                    <input type="tel" value={form.billingPhone} onChange={handleChange("billingPhone")} placeholder="Enter Phone Number..." className={inputClass} />
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>Street Address *</label>
                    <input type="text" value={form.address} onChange={handleChange("address")} placeholder="Enter Street Address..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>City *</label>
                      <input type="text" value={form.city} onChange={handleChange("city")} placeholder="Enter City..." className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>State/Province *</label>
                      <select value={form.stateProvince} onChange={handleChange("stateProvince")} className={selectClass}>
                        <option value="">Select One</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>Country *</label>
                      <select className={selectClass} disabled><option>United States</option></select>
                    </div>
                    <div>
                      <label className={labelClass}>ZIP *</label>
                      <input type="text" value={form.zip} onChange={handleChange("zip")} onBlur={handleBlur("zip")} placeholder="Enter Your ZIP..." className={`${inputClass} ${touched.zip && !isZipValid ? "border-red-400 ring-1 ring-red-400" : ""}`} />
                      {fieldError("zip", isZipValid, "ZIP must be 5 digits.")}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>Credit Card Number *</label>
                    <input type="text" value={form.ccNumber} onChange={handleChange("ccNumber")} onBlur={handleBlur("ccNumber")} placeholder="Enter Your Card Number..." className={`${inputClass} ${touched.ccNumber && !isCardValid ? "border-red-400 ring-1 ring-red-400" : ""}`} />
                    {touched.ccNumber && ccDigits.length > 0 && !isCardLengthValid && <p className="text-xs text-red-500 mt-1">Card number must be 13–16 digits.</p>}
                    {touched.ccNumber && isCardLengthValid && !isLuhnValid && <p className="text-xs text-red-500 mt-1">Invalid card number.</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className={labelClass}>Exp Month*</label>
                      <select value={form.expMonth} onChange={(e) => { handleChange("expMonth")(e); setTouched(p => ({ ...p, expMonth: true })); }} className={selectClass}>
                        <option value="">Month</option>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Exp Year *</label>
                      <select value={form.expYear} onChange={(e) => { handleChange("expYear")(e); setTouched(p => ({ ...p, expYear: true })); }} className={selectClass}>
                        <option value="">Year</option>
                        {Array.from({ length: 10 }, (_, i) => String(2025 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>CVV Code *</label>
                      <input type="text" value={form.cvv} onChange={handleChange("cvv")} onBlur={handleBlur("cvv")} placeholder="CVV..." maxLength={4} className={`${inputClass} ${touched.cvv && !isCvvValid ? "border-red-400 ring-1 ring-red-400" : ""}`} />
                      {fieldError("cvv", isCvvValid, "CVV must be 3 or 4 digits.")}
                    </div>
                  </div>
                  {(touched.expMonth || touched.expYear) && form.expMonth && form.expYear && !isExpValid && (
                    <p className="text-xs text-red-500 mt-1">Card is expired.</p>
                  )}
                </section>
              )}

              {/* PLAID */}
              {paymentMethod === "plaid" && (
                <section className="bg-white rounded border border-gray-200 p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-1">Pay by Bank</h2>
                  <p className="text-xs text-gray-400 mb-4">Powered by Plaid</p>
                  {plaidBankName ? (
                    <div className="text-center space-y-3 py-4">
                      {plaidProcessing ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                          <p className="text-lg font-bold text-gray-800">Processing payment...</p>
                          <p className="text-sm text-gray-500">Connected to {plaidBankName}. Please wait.</p>
                        </>
                      ) : (
                        <>
                          <div className="text-green-600 text-4xl">✓</div>
                          <p className="text-lg font-bold text-gray-800">Connected to {plaidBankName}</p>
                          <p className="text-sm text-gray-500">Your bank account is linked.</p>
                          <button type="button" onClick={() => { setPlaidAccessToken(null); setPlaidBankName(null); }} className="text-sm text-red-500 underline hover:text-red-700">Change bank</button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-600 mb-4">Click below to securely connect your bank account via Plaid.</p>
                      <button
                        type="button"
                        onClick={handlePlaidConnect}
                        disabled={plaidProcessing || !plaidScriptLoaded || !resolvedPlanId}
                        className="h-12 px-8 rounded text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2 mx-auto"
                        style={{ backgroundColor: "#0a85ea" }}
                      >
                        {plaidProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {plaidScriptLoaded ? "Connect Your Bank" : "Loading Plaid..."}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 font-medium tracking-wide">🔒 PLAID</span>
                    <a href="https://plaid.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 hover:text-gray-700">What is Plaid?</a>
                  </div>
                </section>
              )}

              {/* PAYPAL */}
              {paymentMethod === "paypal" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-2">PayPal</h2>
                  {!config?.paypal?.clientId ? (
                    <p className="text-sm text-red-500 py-4">PayPal is not available. Please try another method.</p>
                  ) : !paypalScriptLoaded ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading PayPal...
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-2">You will be redirected to PayPal to complete payment.</p>
                  )}
                </section>
              )}

              {/* GOOGLE PAY */}
              {paymentMethod === "googlepay" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Google Pay</h2>
                  {!gpayScriptLoaded ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading Google Pay...
                    </div>
                  ) : !gpayReady ? (
                    <p className="text-sm text-gray-500 py-4">Google Pay is not available on this device/browser. Please try another method.</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-4">Click below to pay securely with Google Pay.</p>
                      <button
                        type="button"
                        onClick={handleGooglePay}
                        disabled={gpayProcessing}
                        className="h-12 px-8 rounded-full bg-black text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-3 mx-auto hover:bg-gray-800"
                      >
                        {gpayProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                        )}
                        Pay with Google Pay
                      </button>
                    </>
                  )}
                </section>
              )}

              {/* APPLE PAY */}
              {paymentMethod === "applepay" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4"> Pay</h2>
                  <p className="text-sm text-gray-500 mb-4">Click below to pay with  Pay.</p>
                  <button
                    type="button"
                    onClick={handleApplePay}
                    disabled={methodProcessing}
                    className="h-12 px-8 rounded bg-black text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2 mx-auto"
                  >
                    {methodProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                    Pay
                  </button>
                </section>
              )}

              {/* CASH APP PAY (Pockyt) */}
              {paymentMethod === "pockyt" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Cash App Pay</h2>
                  <p className="text-sm text-gray-500 mb-4">You will be redirected to complete payment.</p>
                </section>
              )}

              {/* KLARNA */}
              {paymentMethod === "klarna" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Klarna</h2>
                  <p className="text-sm text-gray-500 mb-4">Buy now, pay later. You will be redirected to Klarna.</p>
                </section>
              )}

              {/* Terms & Place Order — unified for all methods */}
              <section className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Terms & Conditions</h2>
                <p className="text-sm text-gray-600 mb-2">I hereby authorize charges totaling <b className="text-gray-900">${total.toFixed(2)}</b> via my {pmLabel}.</p>
                <p className="text-sm text-gray-600 mb-6">I understand that charge on my {pmLabel} is not refundable under any circumstances.</p>
                <div className="space-y-3 mb-6">
                  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-5 w-5 rounded border-2 border-red-400" style={{ accentColor: "#e53e3e" }} />
                    <span>I agree to <span className="underline text-blue-600 font-medium">Terms and Conditions</span></span>
                  </label>
                  {paymentMethod === "cardpayment" && (
                    <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={savePayment} onChange={(e) => setSavePayment(e.target.checked)} className="h-5 w-5 rounded border-2 border-gray-300" style={{ accentColor: "#e53e3e" }} />
                      Save payment information for next time
                    </label>
                  )}
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={!isFormValid || anyProcessing}
                    onClick={handleSubmit}
                    className="h-14 px-12 rounded-lg text-white font-bold text-base uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2 shadow-lg"
                    style={{ backgroundColor: "#e53e3e" }}
                  >
                    {anyProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
                    PLACE ORDER NOW
                  </button>
                </div>
              </section>
            </div>

            {/* Right — Order Summary */}
            <div className="w-full md:w-[340px] shrink-0 order-first md:order-last">
              <div className="bg-white rounded border border-gray-200 sticky top-16">
                <div className="px-5 py-3 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-800">Order Summary</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Mobile No.</span>
                    <span className="font-semibold text-gray-800">{phone.length === 10 ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Product</span>
                    <span className="font-semibold text-gray-800">{carrierName}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Amount Sent</span>
                    <span className="font-semibold text-gray-800">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Processing Fee</span>
                    <span className="font-semibold text-gray-800">${processingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Sale Tax</span>
                    <span className="font-semibold text-gray-800">${totalTax.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mx-4 mb-4 mt-2 rounded-lg px-5 py-4 flex justify-between items-center text-white" style={{ backgroundColor: ACCENT_GREEN }}>
                  <span className="text-sm font-bold">Total Charges</span>
                  <span className="text-xl font-extrabold">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <PaymentBar />
      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
      </footer>

      {/* Error Dialog */}
      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">{errorDialog.title || "Payment Issue"}</DialogTitle>
            <DialogDescription>{errorDialog.message}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={() => setErrorDialog({ open: false, title: "", message: "" })} className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: ACCENT_GREEN }}>Close</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialog.open} onOpenChange={(open) => setSuccessDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600">Payment Successful!</DialogTitle>
            <DialogDescription>
              Your recharge has been confirmed.
              {successDialog.transactionId && (
                <span className="block mt-2 font-semibold text-gray-800">Transaction ID: {successDialog.transactionId}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={() => { setSuccessDialog({ open: false, transactionId: "" }); navigate("/"); }} className="px-4 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700">Done</button>
          </div>
        </DialogContent>
      </Dialog>

      <AuthDialogs mode={authMode} onClose={() => setAuthMode(null)} onSwitchMode={setAuthMode} />
    </div>
  );
};

export default Checkout;
