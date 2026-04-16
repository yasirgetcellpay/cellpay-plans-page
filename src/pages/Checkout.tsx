import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { LegalBar } from "@/components/LegalBar";
import { PaymentBar } from "@/components/PaymentBar";
import { AccountDropdown } from "@/components/AccountDropdown";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import {
  validateRecharge,
  submitTransaction,
  fetchCheckoutConfig,
  createPayPalOrder,
  capturePayPalOrder,
  createPlaidLinkToken,
  exchangePlaidToken,
  createApplePaySession,
  createKlarnaSession,
  type ValidationResult,
} from "@/services/apiWrapper";
import { useToast } from "@/hooks/use-toast";

interface LocationState {
  phone: string;
  amount: string;
  planId?: string | number;
  carrierSlug: string;
  carrierName: string;
  brandColor: string;
}

type PaymentMethod = "card" | "paypal" | "plaid" | "googlepay" | "applepay" | "klarna" | "cashapp";

declare global {
  interface Window {
    Plaid?: {
      create: (config: Record<string, unknown>) => { open: () => void; destroy: () => void };
    };
    google?: {
      payments?: {
        api?: {
          PaymentsClient: new (config: Record<string, unknown>) => {
            isReadyToPay: (req: Record<string, unknown>) => Promise<{ result: boolean }>;
            loadPaymentData: (req: Record<string, unknown>) => Promise<Record<string, unknown>>;
          };
        };
      };
    };
    ApplePaySession?: {
      new (version: number, req: Record<string, unknown>): {
        begin: () => void;
        onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
        onpaymentauthorized: ((e: { payment: Record<string, unknown> }) => void) | null;
        oncancel: (() => void) | null;
        completeMerchantValidation: (session: unknown) => void;
        completePayment: (result: { status: number }) => void;
        STATUS_SUCCESS: number;
        STATUS_FAILURE: number;
      };
      canMakePayments: () => boolean;
    };
    Klarna?: {
      Payments: {
        init: (config: { client_token: string }) => void;
        load: (
          opts: { container: string; payment_method_category: string },
          cb: (res: { show_form: boolean }) => void
        ) => void;
        authorize: (
          opts: { payment_method_category: string },
          data: Record<string, unknown>,
          cb: (res: { approved: boolean; authorization_token?: string }) => void
        ) => void;
      };
    };
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onCancel?: () => void;
        onError?: (err: unknown) => void;
        style?: Record<string, unknown>;
      }) => {
        render: (container: string | HTMLElement) => Promise<void>;
        close: () => void;
      };
    };
    CashApp?: {
      pay: (config: Record<string, unknown>) => Promise<{ token: string; cashtag: string }>;
    };
  }
}

const loadScript = (src: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const state = location.state as LocationState | null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [showSaveInfoTip, setShowSaveInfoTip] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardZip, setCardZip] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [regionId, setRegionId] = useState("");

  // Klarna billing fields
  const [klarnaFirstName, setKlarnaFirstName] = useState("");
  const [klarnaLastName, setKlarnaLastName] = useState("");
  const [klarnaPhone, setKlarnaPhone] = useState("");
  const [klarnaAddress, setKlarnaAddress] = useState("");
  const [klarnaCity, setKlarnaCity] = useState("");
  const [klarnaState, setKlarnaState] = useState("");
  const [klarnaZip, setKlarnaZip] = useState("");
  const [klarnaCountry, setKlarnaCountry] = useState("US");

  // Checkout config from API (typed)
  const [checkoutConfig, setCheckoutConfig] = useState<Record<string, unknown> | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRef = useRef<{ close: () => void } | null>(null);

  // Success / error dialogs
  // Success now redirects to /order-confirmation page
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Klarna
  const klarnaContainerRef = useRef<HTMLDivElement>(null);
  const [klarnaReady, setKlarnaReady] = useState(false);
  const [klarnaToken, setKlarnaToken] = useState<string | null>(null);

  // Load checkout config and validate recharge
  useEffect(() => {
    if (!state) { navigate("/"); return; }
    (async () => {
      try {
        const [result, config] = await Promise.all([
          validateRecharge(
            state.carrierSlug,
            state.phone.replace(/\D/g, ""),
            state.planId,
            Number(state.amount)
          ),
          fetchCheckoutConfig().catch(() => null),
        ]);
        if (result.success === false) {
          toast({ title: "Validation failed", description: result.message || "Unable to validate this recharge", variant: "destructive" });
          navigate(-1);
          return;
        }
        setValidation(result);
        if (config) {
          console.log("Checkout config loaded:", config);
          setCheckoutConfig(config);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Validation failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load PayPal SDK when config is available and paypal is selected
  useEffect(() => {
    if (!checkoutConfig || paymentMethod !== "paypal") return;
    const paypalConfig = checkoutConfig.paypal as Record<string, unknown> | undefined;
    const clientId = paypalConfig?.clientId as string;
    if (!clientId) return;

    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) { setPaypalReady(true); return; }

    const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons&enable-funding=venmo,paylater&disable-funding=card`;
    loadScript(sdkUrl, "paypal-sdk")
      .then(() => setPaypalReady(true))
      .catch(() => toast({ title: "Error", description: "Failed to load PayPal SDK", variant: "destructive" }));
  }, [checkoutConfig, paymentMethod]);

  // Render PayPal Buttons when SDK is ready
  useEffect(() => {
    if (!paypalReady || paymentMethod !== "paypal" || !window.paypal || !paypalContainerRef.current) return;

    // Clean up previous buttons
    if (paypalButtonsRef.current) {
      try { paypalButtonsRef.current.close(); } catch {}
      paypalButtonsRef.current = null;
    }
    paypalContainerRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "paypal",
        height: 48,
      },
      createOrder: async () => {
        const orderPayload = {
          phone_number: state.phone.replace(/\D/g, ""),
          carrierId: validation?.carrier_id || validation?.carrierId,
          plan_id: state.planId ? String(state.planId) : undefined,
          amount: validation?.amount ?? Number(state.amount),
          total: validation?.total ?? Number(state.amount),
        };

        const orderRaw = await createPayPalOrder(orderPayload) as Record<string, unknown>;
        // Unwrap double-nested
        let orderResult = orderRaw;
        if (orderResult.data && typeof orderResult.data === "object" && !Array.isArray(orderResult.data)) {
          const inner = orderResult.data as Record<string, unknown>;
          if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
            orderResult = inner.data as Record<string, unknown>;
          } else {
            orderResult = inner;
          }
        }

        const orderId = (orderResult.order_id || orderResult.id || orderResult.orderId) as string;
        if (!orderId) {
          // Check if it's a direct success (dev/sandbox mode)
          if (orderResult.status === true || orderResult.status === "true" || orderResult.status === "success" || orderResult.status === "completed") {
            handleResult(orderRaw);
            throw new Error("__DIRECT_SUCCESS__");
          }
          throw new Error("Could not create PayPal order");
        }
        return orderId;
      },
      onApprove: async (data: { orderID: string }) => {
        setSubmitting(true);
        try {
          const captureRaw = await capturePayPalOrder({ order_id: data.orderID }) as Record<string, unknown>;
          // Unwrap
          let captureResult = captureRaw;
          if (captureResult.data && typeof captureResult.data === "object" && !Array.isArray(captureResult.data)) {
            const inner = captureResult.data as Record<string, unknown>;
            if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
              captureResult = inner.data as Record<string, unknown>;
            } else {
              captureResult = inner;
            }
          }

          const status = captureResult.status;
          if (status === "VOIDED" || status === "CANCELLED" || status === "CREATED") {
            setErrorMsg(`PayPal payment ${String(status).toLowerCase()}`);
          } else {
            handleResult(captureRaw);
          }
        } catch {
          setErrorMsg("PayPal capture failed");
        } finally {
          setSubmitting(false);
        }
      },
      onCancel: () => {
        toast({ title: "PayPal", description: "Payment cancelled.", variant: "destructive" });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "__DIRECT_SUCCESS__") return; // handled in createOrder
        console.error("PayPal error:", err);
        setErrorMsg("PayPal payment failed");
      },
    });

    buttons.render(paypalContainerRef.current).catch((err: unknown) => {
      console.error("PayPal render error:", err);
    });
    paypalButtonsRef.current = buttons;

    return () => {
      if (paypalButtonsRef.current) {
        try { paypalButtonsRef.current.close(); } catch {}
        paypalButtonsRef.current = null;
      }
    };
  }, [paypalReady, paymentMethod, validation]);

  const basePayload = useCallback((): Record<string, unknown> => ({
    phone_number: state?.phone.replace(/\D/g, "") || "",
    carrier_slug: state?.carrierSlug || "",
    amount: state?.amount || "",
    plan_id: state?.planId,
    carrier_id: validation?.carrier_id || validation?.carrierId,
  }), [state, validation]);

  if (!state) return null;

  const brandColor = state.brandColor;
  const total = validation?.total ?? Number(state.amount);
  const fee = validation?.fee ?? 0;
  const tax = validation?.tax ?? 0;

  // Card helpers
  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };
  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };
  const isValidLuhn = (num: string): boolean => {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 13) return false;
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  };
  const detectCardType = (num: string): string => {
    const d = num.replace(/\D/g, "");
    if (/^4/.test(d)) return "visa";
    if (/^5[1-5]/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5)/.test(d)) return "discover";
    return "unknown";
  };

  const cardDigits = cardNumber.replace(/\D/g, "");
  const expiryDigits = cardExpiry.replace(/\D/g, "");
  const isCardValid =
    isValidLuhn(cardDigits) &&
    expiryDigits.length === 4 &&
    Number(expiryDigits.slice(0, 2)) >= 1 &&
    Number(expiryDigits.slice(0, 2)) <= 12 &&
    cardCvv.length >= 3 &&
    cardZip.length >= 5 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes("@");

  const isEmailValid = email.trim().length > 0 && email.includes("@") && email.includes(".");

  const canSubmit = agreedTerms && !submitting && isEmailValid && (paymentMethod === "card" ? isCardValid : true);

  const handleResult = (raw: Record<string, unknown>) => {
    // Unwrap double-nested { data: { data: { status, message, transactionId } } }
    let result = raw;
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const inner = result.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
        result = inner.data as Record<string, unknown>;
      } else {
        result = inner;
      }
    }
    const status = result.status;
    const isSuccess = status === true || status === "true" || String(status || "").toLowerCase() === "success" || String(status || "").toLowerCase() === "completed";
    if (isSuccess) {
      const hid = (result.hashid || result.transactionId || result.transaction_id || "") as string;
      const params = new URLSearchParams({ hashid: hid, color: brandColor, carrier: state.carrierName });
      navigate(`/order-confirmation?${params.toString()}`);
    } else {
      setErrorMsg((result.msg as string) || (result.message as string) || "Transaction failed");
    }
  };

  // ─── Credit Card ───
  const handleCard = async () => {
    const payload = {
      checkout_version: "5.0",
      payment_method: "cardpayment",
      amount: validation?.amount ?? Number(state.amount),
      total: validation?.total ?? Number(state.amount),
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId || state.planId,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        zip: cardZip,
        cc_type: detectCardType(cardDigits),
        cc_number: cardDigits,
        cc_exp_month: expiryDigits.slice(0, 2),
        cc_exp_year: "20" + expiryDigits.slice(2),
        cvv_number: cardCvv,
      },
      billing: {
        bill_email: email.trim(),
        country_id: "US",
        region_id: regionId || cardZip,
      },
    };
    const result = await submitTransaction(payload) as Record<string, unknown>;
    handleResult(result);
  };

  // PayPal is now handled entirely by SDK Buttons rendered in the UI

  // ─── Plaid (Pay by Bank) ───
  const handlePlaid = async () => {
    const plaidConfig = checkoutConfig?.plaid as Record<string, unknown> | undefined;
    const scriptUrl = (plaidConfig?.linkInitializeScriptUrl as string) || "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    try {
      await loadScript(scriptUrl, "plaid-sdk");
    } catch {
      setErrorMsg("Failed to load Plaid SDK");
      return;
    }

    const tokenResp = await createPlaidLinkToken({
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      amount: validation?.amount ?? Number(state.amount),
    }) as Record<string, unknown>;
    // Unwrap
    let tokenData = tokenResp;
    if (tokenData.data && typeof tokenData.data === "object") {
      const inner = tokenData.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object") tokenData = inner.data as Record<string, unknown>;
      else tokenData = inner;
    }
    const linkToken = tokenData.link_token as string;
    if (!linkToken) { setErrorMsg("Could not create Plaid link"); return; }
    if (!window.Plaid) { setErrorMsg("Plaid SDK not available"); return; }

    return new Promise<void>((resolve) => {
      const handler = window.Plaid!.create({
        token: linkToken,
        onSuccess: async (publicToken: string, metadata: Record<string, unknown>) => {
          try {
            // Submit transaction directly with plaid_token
            const result = await submitTransaction({
              checkout_version: "5.0",
              payment_method: "plaid",
              amount: validation?.amount ?? Number(state.amount),
              total: validation?.total ?? Number(state.amount),
              phone_number: state.phone.replace(/\D/g, ""),
              carrierId: validation?.carrier_id || validation?.carrierId,
              plan_id: state.planId ? String(state.planId) : undefined,
              agree_desktop: true,
              payment: {
                firstName: firstName.trim() || "Customer",
                lastName: lastName.trim() || "User",
                email: email.trim() || "customer@cellpay.us",
              },
              plaid_token: publicToken,
            }) as Record<string, unknown>;
            handleResult(result);
          } catch {
            setErrorMsg("Bank payment failed");
          }
          setSubmitting(false);
          resolve();
        },
        onExit: () => {
          setSubmitting(false);
          resolve();
        },
      });
      handler.open();
    });
  };

  // ─── Google Pay ───
  const handleGooglePay = async () => {
    try {
      await loadScript("https://pay.google.com/gp/p/js/pay.js", "gpay-sdk");
    } catch {
      setErrorMsg("Failed to load Google Pay SDK");
      return;
    }

    if (!window.google?.payments?.api?.PaymentsClient) {
      setErrorMsg("Google Pay is not available");
      return;
    }

    const gpayConfig = checkoutConfig?.googlePay as Record<string, unknown> | undefined;
    const gpayEnv = (gpayConfig?.environment as string) || "TEST";
    const merchantId = (gpayConfig?.merchantId || "") as string;
    const merchantName = (gpayConfig?.merchantName || "CELLPAY") as string;
    const gatewayMerchantId = (gpayConfig?.gatewayMerchantId || merchantId) as string;
    const paymentGateway = (gpayConfig?.paymentGateway || "cybersource") as string;
    const allowedNetworks = (gpayConfig?.allowedCardNetworks as string[]) || ["AMEX", "DISCOVER", "MASTERCARD", "VISA"];

    const client = new window.google.payments.api.PaymentsClient({ environment: gpayEnv });
    const baseCardMethod = {
      type: "CARD",
      parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: allowedNetworks },
    };

    const ready = await client.isReadyToPay({ apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [baseCardMethod] });
    if (!ready.result) { setErrorMsg("Google Pay is not available on this device"); return; }

    const paymentData = await client.loadPaymentData({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{
        ...baseCardMethod,
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: { gateway: paymentGateway, gatewayMerchantId },
        },
      }],
      transactionInfo: { totalPriceStatus: "FINAL", totalPrice: String(total), currencyCode: (gpayConfig?.currencyCode as string) || "USD", countryCode: (gpayConfig?.countryCode as string) || "US" },
      merchantInfo: { merchantId, merchantName },
    });

    const tokenStr = (paymentData.paymentMethodData as Record<string, unknown>)?.tokenizationData as Record<string, unknown>;
    const result = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "googlepay",
      amount: validation?.amount ?? Number(state.amount),
      total: validation?.total ?? Number(state.amount),
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: email.trim() || "customer@cellpay.us",
      },
      google_pay_token: tokenStr?.token,
    }) as Record<string, unknown>;
    handleResult(result);
  };

  // ─── Apple Pay ───
  const handleApplePay = async () => {
    if (!window.ApplePaySession || !window.ApplePaySession.canMakePayments()) {
      setErrorMsg("Apple Pay is not available on this device. Please use Safari on a supported Apple device.");
      return;
    }

    const appleConfig = checkoutConfig?.applePay as Record<string, unknown> | undefined;
    const displayName = (appleConfig?.displayName as string) || "Cellpay.us";

    const session = new window.ApplePaySession!(3, {
      countryCode: "US",
      currencyCode: "USD",
      supportedNetworks: ["visa", "masterCard", "amex", "discover"],
      merchantCapabilities: ["supports3DS"],
      total: { label: displayName, amount: String(total) },
    });

    session.onvalidatemerchant = async (event) => {
      try {
        const merchantSession = await createApplePaySession({ validationURL: event.validationURL }) as Record<string, unknown>;
        // Unwrap double-nested
        let sessionResult = merchantSession;
        if (sessionResult.data && typeof sessionResult.data === "object") {
          const inner = sessionResult.data as Record<string, unknown>;
          if (inner.data && typeof inner.data === "object") sessionResult = inner.data as Record<string, unknown>;
          else sessionResult = inner;
        }
        session.completeMerchantValidation(sessionResult);
      } catch {
        setErrorMsg("Apple Pay merchant validation failed");
        setSubmitting(false);
      }
    };

    session.onpaymentauthorized = async (event) => {
      try {
        const payment = event.payment;
        const tokenData = (payment.token as Record<string, unknown>)?.paymentData;
        const billingContact = payment.billingContact;

        const raw = await submitTransaction({
          checkout_version: "5.0",
          payment_method: "apple_pay",
          amount: validation?.amount ?? Number(state.amount),
          total: validation?.total ?? Number(state.amount),
          phone_number: state.phone.replace(/\D/g, ""),
          carrierId: validation?.carrier_id || validation?.carrierId,
          plan_id: state.planId ? String(state.planId) : undefined,
          agree_desktop: true,
          payment: {
            firstName: (billingContact as Record<string, unknown>)?.givenName || firstName.trim() || "Customer",
            lastName: (billingContact as Record<string, unknown>)?.familyName || lastName.trim() || "User",
            email: email.trim() || "customer@cellpay.us",
          },
          apple_pay_token: btoa(JSON.stringify(tokenData)),
          apple_pay_billing_contact: JSON.stringify(billingContact),
        }) as Record<string, unknown>;

        // Unwrap
        let result = raw;
        if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
          const inner = result.data as Record<string, unknown>;
          if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
            result = inner.data as Record<string, unknown>;
          } else {
            result = inner;
          }
        }

        const isSuccess = result.status === true || result.status === "true" || String(result.status || "").toLowerCase() === "success" || String(result.status || "").toLowerCase() === "completed";
        if (isSuccess) {
          session.completePayment({ status: session.STATUS_SUCCESS });
          const hid = (result.hashid || result.transactionId || result.transaction_id || "") as string;
          const apParams = new URLSearchParams({ hashid: hid, color: brandColor, carrier: state.carrierName });
          navigate(`/order-confirmation?${apParams.toString()}`);
        } else {
          session.completePayment({ status: session.STATUS_FAILURE });
          setErrorMsg((result.msg as string) || (result.message as string) || "Apple Pay transaction failed");
        }
      } catch {
        session.completePayment({ status: session.STATUS_FAILURE });
        setErrorMsg("Apple Pay payment failed");
      }
      setSubmitting(false);
    };

    session.oncancel = () => { setSubmitting(false); };
    session.begin();
    return; // keep submitting true
  };

  // ─── Klarna ───
  const buildKlarnaPayload = (authToken: string) => ({
    checkout_version: "5.0",
    payment_method: "klarna",
    amount: validation?.amount ?? Number(state.amount),
    total: validation?.total ?? Number(state.amount),
    phone_number: state.phone.replace(/\D/g, ""),
    carrierId: validation?.carrier_id || validation?.carrierId,
    plan_id: state.planId ? String(state.planId) : undefined,
    agree_desktop: true,
    payment: {
      firstName: firstName.trim() || "Customer",
      lastName: lastName.trim() || "User",
      email: email.trim() || "customer@cellpay.us",
    },
    klarna_auth_token: authToken,
  });

  const handleKlarna = async () => {
    if (klarnaToken) {
      const result = await submitTransaction(buildKlarnaPayload(klarnaToken)) as Record<string, unknown>;
      handleResult(result);
      return;
    }

    const klarnaConfig = checkoutConfig?.klarna as Record<string, unknown> | undefined;
    const klarnaScriptUrl = (klarnaConfig?.paymentsScriptUrl as string) || "https://x.klarnacdn.net/kp/lib/v1/api.js";
    try {
      await loadScript(klarnaScriptUrl, "klarna-sdk");
    } catch {
      setErrorMsg("Failed to load Klarna SDK");
      return;
    }

    const sessionResp = await createKlarnaSession({
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      amount: validation?.total ?? Number(state.amount),
    }) as Record<string, unknown>;

    let sessionData = sessionResp;
    if (sessionData.data && typeof sessionData.data === "object") {
      const inner = sessionData.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object") sessionData = inner.data as Record<string, unknown>;
      else sessionData = inner;
    }
    const clientToken = sessionData.client_token as string;
    if (!clientToken) { setErrorMsg("Could not create Klarna session"); return; }

    if (!window.Klarna) { setErrorMsg("Klarna SDK not available"); return; }

    window.Klarna.Payments.init({ client_token: clientToken });

    return new Promise<void>((resolve) => {
      window.Klarna!.Payments.authorize(
        { payment_method_category: "pay_later" },
        {
          billing_address: {
            given_name: klarnaFirstName,
            family_name: klarnaLastName,
            email: email.trim(),
            phone: klarnaPhone.replace(/\D/g, ""),
            street_address: klarnaAddress,
            city: klarnaCity,
            region: klarnaState,
            postal_code: klarnaZip,
            country: klarnaCountry || "US",
          },
        },
        async (res) => {
          if (res.approved && res.authorization_token) {
            setKlarnaToken(res.authorization_token);
            try {
              const result = await submitTransaction(buildKlarnaPayload(res.authorization_token)) as Record<string, unknown>;
              handleResult(result);
            } catch {
              setErrorMsg("Klarna payment failed");
            }
          } else {
            setErrorMsg("Klarna authorization was declined or cancelled");
          }
          setSubmitting(false);
          resolve();
        }
      );
    });
  };

  // ─── Cash App (Pockyt) ───
  const handleCashApp = async () => {
    const raw = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "pockyt",
      amount: validation?.amount ?? Number(state.amount),
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: email.trim() || "customer@cellpay.us",
      },
    }) as Record<string, unknown>;

    // Unwrap double-nested response
    let result = raw;
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const inner = result.data as Record<string, unknown>;
      if (inner.data && typeof inner.data === "object" && !Array.isArray(inner.data)) {
        result = inner.data as Record<string, unknown>;
      } else {
        result = inner;
      }
    }

    // Check for HostedURL redirect
    const hostedUrl = (result.HostedURL || result.hostedUrl || result.hosted_url) as string;
    const dataObj = result.data as Record<string, unknown> | undefined;
    const nestedHostedUrl = hostedUrl || (dataObj?.HostedURL as string);

    if (nestedHostedUrl) {
      const w = 500, h = 700;
      const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
      const popup = window.open(nestedHostedUrl, "CashAppPay", `width=${w},height=${h},left=${left},top=${top}`);

      const poll = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(poll);
          toast({ title: "Cash App Pay", description: "Payment window closed. Check your order status." });
          setSubmitting(false);
        }
      }, 1000);
      return;
    }

    // Direct response
    handleResult(raw);
  };



  // ─── Main handler ───
  const handlePlaceOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      switch (paymentMethod) {
        case "card": await handleCard(); break;
        case "paypal": return; // PayPal is handled by SDK Buttons in the UI
        case "plaid": await handlePlaid(); return;
        case "googlepay": await handleGooglePay(); break;
        case "applepay": await handleApplePay(); return;
        case "klarna": await handleKlarna(); return;
        case "cashapp": await handleCashApp(); return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setErrorMsg(msg);
    } finally {
      if (!["paypal", "plaid", "applepay", "klarna", "cashapp"].includes(paymentMethod)) {
        setSubmitting(false);
      }
    }
  };

  const paymentMethods: { key: PaymentMethod; label: string }[] = [
    { key: "card", label: "Credit Card" },
    { key: "paypal", label: "PayPal" },
    { key: "plaid", label: "Pay by Bank" },
    { key: "googlepay", label: "Google Pay" },
    { key: "applepay", label: "Apple Pay" },
    { key: "klarna", label: "Klarna" },
    { key: "cashapp", label: "Cash App" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-card border-b-4 shadow-sm" style={{ borderColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center h-14 sm:h-16 items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <span className="font-bold text-lg text-foreground">Checkout</span>
            <AccountDropdown />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-primary-foreground py-3 text-center" style={{ backgroundColor: brandColor }}>
        <h1 className="text-xl font-extrabold">{state.carrierName} Recharge</h1>
      </section>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Order summary */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium text-foreground">{state.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground">${state.amount}</span></div>
              {fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-medium text-foreground">${Number(fee).toFixed(2)}</span></div>}
              {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-medium text-foreground">${Number(tax).toFixed(2)}</span></div>}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-foreground">Total</span>
                <span style={{ color: brandColor }}>${Number(total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Email (required for all payment methods) */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">Contact Information</h2>
            <input type="email" placeholder="Email Address *" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
            {email.length > 0 && !email.includes("@") && (
              <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
            )}
          </div>

          {/* Payment Method Select */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-foreground mb-3 text-sm">Payment Method</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  className={`rounded-lg border-2 py-2 px-3 text-xs font-bold transition-all ${
                    paymentMethod === m.key
                      ? "border-current text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-current"
                  }`}
                  style={paymentMethod === m.key ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card form (only shown for credit card) */}
          {paymentMethod === "card" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h2 className="font-bold text-foreground mb-1 text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Card Details
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <input type="text" placeholder="Street Address" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="State" value={regionId} onChange={(e) => setRegionId(e.target.value.toUpperCase().slice(0, 2))} maxLength={2}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="ZIP" value={cardZip} onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 5))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <input type="text" placeholder="Card Number" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="CVV" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
            </div>
          )}

          {/* PayPal Buttons container (rendered by SDK) */}
          {paymentMethod === "paypal" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h2 className="font-bold text-foreground mb-1 text-sm">PayPal Checkout</h2>
              {!paypalReady ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading PayPal...</span>
                </div>
              ) : (
                <div ref={paypalContainerRef} id="paypal-button-container" />
              )}
            </div>
          )}

          {/* Klarna Billing Details */}
          {paymentMethod === "klarna" && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h2 className="font-bold text-foreground mb-1 text-sm">Billing Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">First Name <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="First Name" value={klarnaFirstName} onChange={(e) => setKlarnaFirstName(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Last Name <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="Last Name" value={klarnaLastName} onChange={(e) => setKlarnaLastName(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bill Payer's Phone Number <span className="text-destructive">*</span></label>
                <input type="tel" placeholder="(000) 000-0000" value={klarnaPhone} onChange={(e) => setKlarnaPhone(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Street Address <span className="text-destructive">*</span></label>
                <input type="text" placeholder="Street Address" value={klarnaAddress} onChange={(e) => setKlarnaAddress(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">City <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="City" value={klarnaCity} onChange={(e) => setKlarnaCity(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">State/Province <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="State" value={klarnaState} onChange={(e) => setKlarnaState(e.target.value.toUpperCase())}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Country <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="United States" value={klarnaCountry} onChange={(e) => setKlarnaCountry(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">ZIP <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="ZIP Code" value={klarnaZip} onChange={(e) => setKlarnaZip(e.target.value.replace(/\D/g, "").slice(0, 5))} maxLength={5}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>
            </div>
          )}

          {/* Klarna container (hidden, used by SDK) */}
          <div ref={klarnaContainerRef} id="klarna-payments-container" className="hidden" />

          {/* Terms + Place Order */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: brandColor }} />
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <a href="https://www.cellpay.us/terms-and-conditions.html" className="underline font-semibold" style={{ color: brandColor }}>
                  Terms & Conditions
                </a>{" "}
                and confirm this sale is final.
              </span>
            </label>

            {paymentMethod === "card" && (
              <>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: brandColor }} />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Save payment information for next time?</span>{" "}
                    <button
                      type="button"
                      onClick={() => setShowSaveInfoTip(true)}
                      className="underline font-semibold"
                      style={{ color: brandColor }}
                    >
                      (What's this)
                    </button>
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoPay} onChange={(e) => setAutoPay(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: brandColor }} />
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Subscribe to Auto Pay?</span>
                  </span>
                </label>
              </>
            )}

            {paymentMethod !== "paypal" && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handlePlaceOrder}
                className="w-full h-[48px] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitting ? "Processing..." : "PLACE ORDER NOW"}
              </button>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Secure payment powered by CellPay. Instant refill sent directly to your phone.
            </p>
          </div>
        </div>
      )}



      {/* Error dialog */}
      {errorMsg && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setErrorMsg(null)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">❌</div>
            <h3 className="text-xl font-bold text-foreground mb-2">Payment Failed</h3>
            <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
            <button type="button" onClick={() => setErrorMsg(null)}
              className="px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              Try Again
            </button>
          </div>
        </div>
      )}
      <PaymentBar />
      <Footer />
      <LegalBar />
    </div>
  );
};

export default Checkout;
