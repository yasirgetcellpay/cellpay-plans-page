import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCheckout } from "@/hooks/use-checkout";
import { useCheckoutConfig } from "@/hooks/use-checkout-config";
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

const PROCESSING_FEE = 5.99;
const NAV_COLOR = "#2d3748";
const ACCENT_RED = "#e53e3e";

const paymentMethods = [
  { id: "cardpayment", label: "Credit Card", icon: "💳" },
  { id: "plaid", label: "Pay by Bank", subtitle: "Instant Login, No Manual Entry", icon: "⚙️" },
  { id: "paypal", label: "Paypal", icon: "🅿️" },
  { id: "googlepay", label: "Google Pay", icon: "G" },
  { id: "applepay", label: "Apple Pay", icon: "🍎" },
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

  const [paymentMethod, setPaymentMethod] = useState<string>("cardpayment");
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

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No order information found.</p>
          <Link to="/" className="text-blue-600 underline">Go back home</Link>
        </div>
      </div>
    );
  }

  const { phone, amount, planId, carrierId, carrierName, carrierSlug } = state;
  const total = amount + PROCESSING_FEE;
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
    plan_id: planId,
    slug: carrierSlug,
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
            region_name: form.stateProvince,
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
    if (result?.data?.HostedURL) {
      window.location.href = result.data.HostedURL;
    } else if (result?.success || result?.data?.status) {
      const txId = result?.data?.transactionId || "";
      setSuccessDialog({ open: true, transactionId: txId });
    } else {
      setErrorDialog({
        open: true,
        title: "Payment Failed",
        message: `${methodName} payment could not be completed. Please try again or contact support.`,
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
      // Try CellPay backend first, fall back to our own Plaid edge function
      let linkToken: string | null = null;

      const linkResult = await createPlaidLinkToken<any>({});
      const linkData = linkResult.data?.data ?? linkResult.data;
      linkToken = linkData?.link_token || null;

      // Fallback: use our own Plaid edge function if upstream fails
      if (!linkToken) {
        console.warn("CellPay plaid-link-token failed, falling back to own edge function");
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: fallbackData } = await supabase.functions.invoke("plaid-link-token", {
          body: { user_id: "checkout-user" },
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

  // --- PAYPAL handler ---
  const handlePaypalPayment = async () => {
    if (!(window as any).paypal) {
      toast.error("PayPal SDK not loaded yet.");
      return;
    }
    // PayPal buttons render will handle this; we render them inline
  };

  // Render PayPal buttons
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);

  useEffect(() => {
    if (paymentMethod !== "paypal" || !paypalScriptLoaded || !(window as any).paypal || !paypalContainerRef.current || paypalButtonsRendered.current) return;
    paypalButtonsRendered.current = true;

    (window as any).paypal.Buttons({
      createOrder: async () => {
        try {
          const res = await createPaypalOrder<any>({ amount: total, currency: "USD", description: `${carrierName} refill - ${phone}` });
          const orderData = res.data?.data ?? res.data;
          return orderData?.id || orderData?.orderID;
        } catch (err) {
          console.error("PayPal create order error:", err);
          throw err;
        }
      },
      onApprove: async (data: any) => {
        setPaypalProcessing(true);
        try {
          // Capture the order
          await capturePaypalOrder<any>({ orderID: data.orderID });

          // Now call checkout transaction
          const payload = buildPayload();
          const result = await processCheckout(payload);
          handleCheckoutResult(result, "PayPal");
        } catch (err) {
          console.error("PayPal capture error:", err);
          setErrorDialog({ open: true, title: "PayPal Error", message: "Payment approved but order could not be completed." });
        } finally {
          setPaypalProcessing(false);
        }
      },
      onCancel: () => {
        setErrorDialog({ open: true, title: "Payment Cancelled", message: "You cancelled the PayPal payment. No charges were made." });
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        setErrorDialog({ open: true, title: "PayPal Error", message: "An error occurred with PayPal. Please try again." });
      },
    }).render(paypalContainerRef.current);
  }, [paymentMethod, paypalScriptLoaded]);

  // Reset paypal buttons ref when switching away
  useEffect(() => {
    if (paymentMethod !== "paypal") {
      paypalButtonsRendered.current = false;
    }
  }, [paymentMethod]);

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
      case "cardpayment":
      default: {
        const payload = buildPayload();
        const result = await processCheckout(payload);
        handleCheckoutResult(result, "Credit Card");
      }
    }
  };

  const anyProcessing = processing || plaidProcessing || paypalProcessing || gpayProcessing || methodProcessing;

  const inputClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";
  const selectClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 text-white" style={{ backgroundColor: NAV_COLOR }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <Link to="/" className="text-lg font-bold tracking-tight">cellpay<span className="align-super text-[9px]">®</span></Link>
          <div className="hidden sm:flex items-center gap-5 text-xs font-medium">
            <Link to="/" className="hover:underline">Domestic Payments</Link>
            <span className="opacity-70">Bill Payments</span>
            <span className="opacity-70">International Topups</span>
            <span className="opacity-70">SIM Cards</span>
            <span className="opacity-70">Promotions</span>
          </div>
        </div>
      </nav>

      {/* Banner */}
      <div className="text-white py-5" style={{ backgroundColor: ACCENT_RED }}>
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
                          isActive ? "border-red-500 bg-white text-red-600" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-2xl leading-none shrink-0">{pm.icon}</span>
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
                        disabled={plaidProcessing || !plaidScriptLoaded}
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
                <section className="bg-gray-100 rounded-lg p-6 space-y-5">
                  {!config?.paypal?.clientId ? (
                    <p className="text-sm text-red-500 text-center py-4">PayPal is not available. Please try another method.</p>
                  ) : !paypalScriptLoaded ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading PayPal...
                    </div>
                  ) : (
                    <>
                      {paypalProcessing && (
                        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                          <Loader2 className="h-5 w-5 animate-spin" /> Processing PayPal payment...
                        </div>
                      )}
                      <div ref={paypalContainerRef} />
                    </>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-2">Service Agreement</h3>
                    <p className="text-sm text-gray-500">Service provided by cellpay not associated with any carrier, by agreeing with this you are authorizing us to make payment behalf of you to carrier</p>
                  </div>
                </section>
              )}

              {/* GOOGLE PAY */}
              {paymentMethod === "googlepay" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Google Pay</h2>
                  <p className="text-sm text-gray-500 mb-4">Click below to pay with Google Pay.</p>
                  <button
                    type="button"
                    onClick={handleGooglePay}
                    disabled={gpayProcessing}
                    className="h-12 px-8 rounded bg-black text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2 mx-auto"
                  >
                    {gpayProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Pay with Google Pay
                  </button>
                </section>
              )}

              {/* APPLE PAY */}
              {paymentMethod === "applepay" && (
                <section className="bg-white rounded border border-gray-200 p-5 text-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Apple Pay</h2>
                  <p className="text-sm text-gray-500 mb-4">Click below to pay with Apple Pay.</p>
                  <button
                    type="button"
                    onClick={handleApplePay}
                    disabled={methodProcessing}
                    className="h-12 px-8 rounded bg-black text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2 mx-auto"
                  >
                    {methodProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Pay with Apple Pay
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

              {/* Terms */}
              <section className="bg-white rounded border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-3">Terms & Conditions</h2>
                <p className="text-xs text-gray-500 mb-1">I hereby authorize charges totaling <b>${total.toFixed(2)}</b> via my {pmLabel}.</p>
                <p className="text-xs text-gray-500 mb-4">I understand that charge on my {pmLabel} is not refundable under any circumstances.</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: ACCENT_RED }} />
                    <span>I agree to <span className="underline text-blue-600">Terms and Conditions</span></span>
                  </label>
                  {paymentMethod === "cardpayment" && (
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={savePayment} onChange={(e) => setSavePayment(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: ACCENT_RED }} />
                      Save payment information for next time
                    </label>
                  )}
                </div>
              </section>

              {/* Submit — hidden for PayPal (buttons handle it) */}
              {paymentMethod !== "paypal" && (
                <div className="flex justify-center pb-4">
                  <button
                    type="button"
                    disabled={!isFormValid || anyProcessing}
                    onClick={handleSubmit}
                    className="h-12 px-10 rounded text-white font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                    style={{ backgroundColor: ACCENT_RED }}
                  >
                    {anyProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                    PLACE ORDER NOW
                  </button>
                </div>
              )}
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
                    <span className="font-semibold text-gray-800">${PROCESSING_FEE.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-gray-500">Sale Tax</span>
                    <span className="font-semibold text-gray-800">$0.00</span>
                  </div>
                </div>
                <div className="mx-4 mb-4 mt-2 rounded-lg px-5 py-4 flex justify-between items-center text-white" style={{ backgroundColor: ACCENT_RED }}>
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
            <button type="button" onClick={() => setErrorDialog({ open: false, title: "", message: "" })} className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: ACCENT_RED }}>Close</button>
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
    </div>
  );
};

export default Checkout;
