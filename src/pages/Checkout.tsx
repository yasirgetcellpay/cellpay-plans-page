import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { LegalBar } from "@/components/LegalBar";
import { PaymentBar } from "@/components/PaymentBar";
import { AccountDropdown } from "@/components/AccountDropdown";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, CreditCard, Loader2, Building2, Wallet, Apple, Smartphone, CheckCircle2, ShieldCheck, Lock, Headphones } from "lucide-react";
import { CardBrandsStrip, PayPalMark, ApplePayMark, GooglePayMark, KlarnaMark, CashAppMark, BankMark } from "@/components/PaymentBrands";
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
import { getGclid } from "@/lib/tracking";
import { SUPPORTED_COUNTRIES, getSubdivisions, normalizeRegionCode } from "@/lib/subdivisions";

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
        oncancel: ((e?: unknown) => void) | null;
        completeMerchantValidation: (session: unknown) => void;
        completePayment: (result: { status: number }) => void;
        abort: () => void;
        STATUS_SUCCESS: number;
        STATUS_FAILURE: number;
      };
      canMakePayments: () => boolean;
      canMakePaymentsWithActiveCard?: (merchantId: string) => Promise<boolean>;
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
  const [autoPayTerms, setAutoPayTerms] = useState(false);
  const [showSaveInfoTip, setShowSaveInfoTip] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  // Unique session identifier — generated once per checkout flow and reused
  // across kount_ssid / riskified_sessionid / cbsys_sessionid on every request.
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
  }

  // Visitor IP — fetched once on mount and sent as `source` on every transaction.
  const visitorIpRef = useRef<string>("");

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
  const [regionOther, setRegionOther] = useState(false);
  const [country, setCountry] = useState("US");

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

  // Browser fingerprint (FingerprintJS Pro)
  const browserInfoRef = useRef<string>("");

  const getClientProps = useCallback(() => {
    try {
      return {
        languages: (navigator.languages || []).join(",") || navigator.language || "",
        screenResolution: screen?.width && screen?.height ? `${screen.width}x${screen.height}` : "",
        timezone: Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone || "" : "",
        platform: navigator.platform || "",
        vendor: navigator.vendor || "",
      };
    } catch {
      return {};
    }
  }, []);

  // Hide Tidio chat overlay on mobile during checkout — feedback #3, #19, #34
  // Also scroll to top on mount so users always land on the "Checkout" H1 on
  // mobile (feedback Page 4–5 #1).
  useEffect(() => {
    document.body.classList.add("hide-chat-mobile");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return () => document.body.classList.remove("hide-chat-mobile");
  }, []);

  // Load FingerprintJS Pro and capture visitor identifier
  useEffect(() => {
    let cancelled = false;
    // Set a baseline payload immediately so we always send something
    browserInfoRef.current = JSON.stringify(getClientProps());

    (async () => {
      try {
        const FingerprintJS = await (new Function(
          "return import('https://fpjscdn.net/v3/4zITUeuShmfN065uFVho')"
        )() as Promise<{ load: () => Promise<{ get: () => Promise<{ visitorId: string; requestId?: string }> }> }>);
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (cancelled) return;
        browserInfoRef.current = JSON.stringify({
          visitorId: result.visitorId,
          requestId: result.requestId || "",
          ...getClientProps(),
        });
      } catch (err) {
        console.warn("FingerprintJS Pro error", err);
      }
    })();

    return () => { cancelled = true; };
  }, [getClientProps]);

  // Resolve visitor public IP for the `source` field. Best-effort — if the
  // lookup fails (offline / blocked), we send an empty string.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { ip?: string };
        if (!cancelled && data?.ip) visitorIpRef.current = data.ip;
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Detect Apple Pay availability (Safari on supported Apple devices)
  // Mirrors reference site: uses canMakePaymentsWithActiveCard against the merchant ID
  useEffect(() => {
    let cancelled = false;
    const aps = window.ApplePaySession;
    if (!aps || typeof aps.canMakePayments !== "function" || !aps.canMakePayments()) return;

    const merchantId =
      ((checkoutConfig?.applePay as Record<string, unknown> | undefined)?.merchantIdentifier as string) ||
      "merchant.cellpay.us";

    if (typeof aps.canMakePaymentsWithActiveCard === "function") {
      aps
        .canMakePaymentsWithActiveCard(merchantId)
        .then((ok) => {
          if (!cancelled) setApplePayAvailable(!!ok);
        })
        .catch(() => {
          // fallback: at least the device supports Apple Pay even if no provisioned card check works
          if (!cancelled) setApplePayAvailable(true);
        });
    } else {
      setApplePayAvailable(true);
    }
    return () => {
      cancelled = true;
    };
  }, [checkoutConfig]);

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
  const subdivisions = useMemo(() => getSubdivisions(country), [country]);
  const hasSubdivisions = subdivisions.length > 0;

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
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5|4[4-9])/.test(d)) return "discover";
    if (/^3(?:0[0-5]|[689])/.test(d)) return "diners";
    if (/^35(2[89]|[3-8]\d)/.test(d)) return "jcb";
    return "unknown";
  };

  // Short network code for the `ctype` field (VI, MC, AE, DI, DN, JCB).
  const detectCardCode = (num: string): string => {
    switch (detectCardType(num)) {
      case "visa": return "VI";
      case "mastercard": return "MC";
      case "amex": return "AE";
      case "discover": return "DI";
      case "diners": return "DN";
      case "jcb": return "JCB";
      default: return "";
    }
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

  const canSubmit = agreedTerms && !submitting && isEmailValid && (paymentMethod === "card" ? isCardValid : true) && (!autoPay || autoPayTerms);

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
        cc_type: detectCardCode(cardDigits),
        cc_number: cardDigits,
        cc_exp_month: expiryDigits.slice(0, 2),
        cc_exp_year: "20" + expiryDigits.slice(2),
        cvv_number: cardCvv,
        save_cc: saveCard,
        autopay: autoPay,
        autopay_agreement: autoPay && autoPayTerms,
      },
      billing: {
        bill_email: email.trim(),
        country_id: country,
        region_id: normalizeRegionCode(country, regionId) || cardZip,
      },
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
      ctype: detectCardCode(cardDigits),
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
              browser_info: browserInfoRef.current,
              gclid: getGclid(),
              kount_ssid: sessionIdRef.current,
              riskified_sessionid: sessionIdRef.current,
              cbsys_sessionid: sessionIdRef.current,
              source: visitorIpRef.current,
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
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
    }) as Record<string, unknown>;
    handleResult(result);
  };

  // ─── Apple Pay ───
  const handleApplePay = async () => {
    console.log("[ApplePay] handleApplePay invoked");
    if (!window.ApplePaySession) {
      const msg = "Apple Pay is not available: window.ApplePaySession is undefined (use Safari on a supported Apple device).";
      console.error("[ApplePay]", msg);
      setErrorMsg(msg);
      return;
    }
    try {
      const canMake = window.ApplePaySession.canMakePayments();
      console.log("[ApplePay] canMakePayments() =", canMake);
      if (!canMake) {
        const msg = "Apple Pay is not available: canMakePayments() returned false.";
        console.error("[ApplePay]", msg);
        setErrorMsg(msg);
        return;
      }
    } catch (e) {
      console.error("[ApplePay] canMakePayments() threw", e);
      setErrorMsg("Apple Pay availability check failed: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    const appleConfig = checkoutConfig?.applePay as Record<string, unknown> | undefined;
    const displayName = (appleConfig?.displayName as string) || "Cellpay.us";
    console.log("[ApplePay] config", { displayName, total, host: window.location.hostname });

    let session: InstanceType<NonNullable<typeof window.ApplePaySession>>;
    try {
      session = new window.ApplePaySession!(3, {
        countryCode: "US",
        currencyCode: "USD",
        supportedNetworks: ["visa", "masterCard", "amex", "discover"],
        merchantCapabilities: ["supports3DS"],
        total: { label: displayName, amount: String(total) },
        requiredBillingContactFields: ["postalAddress", "email", "phone"],
      });
      console.log("[ApplePay] session created", session);
    } catch (e) {
      console.error("[ApplePay] new ApplePaySession failed", e);
      setErrorMsg("Apple Pay session creation failed: " + (e instanceof Error ? e.message : String(e)));
      setSubmitting(false);
      return;
    }

    session.onvalidatemerchant = async (event) => {
      console.log("[ApplePay] onvalidatemerchant fired", event.validationURL);
      try {
        const merchantSession = await createApplePaySession({ validationURL: event.validationURL }) as Record<string, unknown>;
        console.log("[ApplePay] raw merchant session response", merchantSession);
        // Recursively unwrap any { success, data } wrappers until we find the real Apple session
        let sessionResult: Record<string, unknown> = merchantSession;
        for (let i = 0; i < 5; i++) {
          if (
            sessionResult &&
            typeof sessionResult === "object" &&
            !sessionResult.merchantSessionIdentifier &&
            sessionResult.data &&
            typeof sessionResult.data === "object"
          ) {
            sessionResult = sessionResult.data as Record<string, unknown>;
          } else {
            break;
          }
        }
        if (!sessionResult.merchantSessionIdentifier) {
          console.error("[ApplePay] Invalid merchant session payload (no merchantSessionIdentifier)", merchantSession);
          setErrorMsg("Apple Pay merchant validation returned an invalid session. See console for details.");
          session.abort();
          setSubmitting(false);
          return;
        }
        console.log("[ApplePay] unwrapped merchant session", {
          merchantSessionIdentifier: sessionResult.merchantSessionIdentifier,
          domainName: sessionResult.domainName,
          displayName: sessionResult.displayName,
          expiresAt: sessionResult.expiresAt,
          currentHost: window.location.hostname,
        });
        if (sessionResult.domainName && sessionResult.domainName !== window.location.hostname) {
          console.warn(
            "[ApplePay] DOMAIN MISMATCH: merchant session domainName =",
            sessionResult.domainName,
            "but page is on",
            window.location.hostname,
            "— Apple Pay will reject this session."
          );
        }
        try {
          session.completeMerchantValidation(sessionResult);
          console.log("[ApplePay] completeMerchantValidation succeeded");
        } catch (innerErr) {
          console.error("[ApplePay] completeMerchantValidation threw", innerErr);
          setErrorMsg(
            "Apple Pay merchant validation failed: " +
              (innerErr instanceof Error ? innerErr.message : String(innerErr))
          );
          setSubmitting(false);
        }
      } catch (err) {
        console.error("[ApplePay] onvalidatemerchant error", err);
        setErrorMsg(
          "Apple Pay merchant validation request failed: " +
            (err instanceof Error ? err.message : String(err))
        );
        try { session.abort(); } catch (abortErr) { console.warn("[ApplePay] session.abort() failed", abortErr); }
        setSubmitting(false);
      }
    };

    session.onpaymentauthorized = async (event) => {
      console.log("[ApplePay] onpaymentauthorized fired");
      try {
        const payment = event.payment;
        const tokenData = (payment.token as Record<string, unknown>)?.paymentData;
        const billingContact = payment.billingContact;
        console.log("[ApplePay] payment authorized, submitting transaction", { hasToken: !!tokenData });

        const raw = await submitTransaction({
          checkout_version: "5.0",
          payment_method: "applepay",
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
          browser_info: browserInfoRef.current,
          gclid: getGclid(),
          kount_ssid: sessionIdRef.current,
          riskified_sessionid: sessionIdRef.current,
          cbsys_sessionid: sessionIdRef.current,
          source: visitorIpRef.current,
        }) as Record<string, unknown>;
        console.log("[ApplePay] transaction response", raw);

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
          console.log("[ApplePay] transaction success");
          session.completePayment({ status: session.STATUS_SUCCESS });
          const hid = (result.hashid || result.transactionId || result.transaction_id || "") as string;
          const apParams = new URLSearchParams({ hashid: hid, color: brandColor, carrier: state.carrierName });
          navigate(`/order-confirmation?${apParams.toString()}`);
        } else {
          console.error("[ApplePay] transaction failed", result);
          session.completePayment({ status: session.STATUS_FAILURE });
          setErrorMsg((result.msg as string) || (result.message as string) || "Apple Pay transaction failed");
        }
      } catch (err) {
        console.error("[ApplePay] onpaymentauthorized error", err);
        session.completePayment({ status: session.STATUS_FAILURE });
        setErrorMsg("Apple Pay payment failed: " + (err instanceof Error ? err.message : String(err)));
      }
      setSubmitting(false);
    };

    session.oncancel = (event) => {
      console.warn("[ApplePay] oncancel fired", event);
      setSubmitting(false);
    };

    try {
      console.log("[ApplePay] calling session.begin()");
      session.begin();
    } catch (e) {
      console.error("[ApplePay] session.begin() threw", e);
      setErrorMsg("Apple Pay could not start: " + (e instanceof Error ? e.message : String(e)));
      setSubmitting(false);
      return;
    }
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
    browser_info: browserInfoRef.current,
    gclid: getGclid(),
    kount_ssid: sessionIdRef.current,
    riskified_sessionid: sessionIdRef.current,
    cbsys_sessionid: sessionIdRef.current,
    source: visitorIpRef.current,
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
    // Build absolute return URL pointing back to this app
    const cashappReturnUrl = `${window.location.origin}/checkout/cashapp-return`;

    // Persist context so the return page can rebuild the success redirect
    try {
      sessionStorage.setItem(
        "cashapp_return_ctx",
        JSON.stringify({ brandColor, carrier: state.carrierName })
      );
    } catch {
      /* ignore */
    }

    const raw = await submitTransaction({
      checkout_version: "5.0",
      payment_method: "pockyt",
      amount: validation?.amount ?? Number(state.amount),
      phone_number: state.phone.replace(/\D/g, ""),
      carrierId: validation?.carrier_id || validation?.carrierId,
      plan_id: state.planId ? String(state.planId) : undefined,
      agree_desktop: true,
      cashapp_return_url: cashappReturnUrl,
      payment: {
        firstName: firstName.trim() || "Customer",
        lastName: lastName.trim() || "User",
        email: email.trim() || "customer@cellpay.us",
      },
      browser_info: browserInfoRef.current,
      gclid: getGclid(),
      kount_ssid: sessionIdRef.current,
      riskified_sessionid: sessionIdRef.current,
      cbsys_sessionid: sessionIdRef.current,
      source: visitorIpRef.current,
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
      window.location.href = nestedHostedUrl;
      return;
    }

    // Direct response (no redirect needed)
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

  // Detect iOS for Apple Pay priority — feedback #31
  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

  type MethodEntry = { key: PaymentMethod; label: string; Brand: React.ComponentType<{ className?: string }> };
  const baseMethods: MethodEntry[] = [
    { key: "card", label: "Card", Brand: CardBrandsStrip },
    ...(applePayAvailable ? [{ key: "applepay" as PaymentMethod, label: "Apple Pay", Brand: ApplePayMark }] : []),
    { key: "googlepay", label: "Google Pay", Brand: GooglePayMark },
    { key: "paypal", label: "PayPal", Brand: PayPalMark },
    { key: "plaid", label: "Pay by Bank", Brand: BankMark },
    { key: "cashapp", label: "Cash App", Brand: CashAppMark },
    { key: "klarna", label: "Klarna", Brand: KlarnaMark }, // Klarna last — feedback #31
  ];
  // On iOS, push Apple Pay to first position (after Credit Card stays default but Apple Pay prominent)
  const paymentMethods: MethodEntry[] = isIOS && applePayAvailable
    ? [
        baseMethods.find(m => m.key === "applepay")!,
        ...baseMethods.filter(m => m.key !== "applepay"),
      ]
    : baseMethods;

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
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Phone</span><span className="font-medium text-foreground inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-cellpay-green" />{state.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground">${state.amount}</span></div>
              {fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-medium text-foreground">${Number(fee).toFixed(2)}</span></div>}
              {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-medium text-foreground">${Number(tax).toFixed(2)}</span></div>}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-foreground">Total</span>
                <span style={{ color: brandColor }}>${Number(total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Checkout trust badges — feedback Page 5–6 #2 */}
          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex items-center justify-around gap-2 text-[11px] font-semibold text-muted-foreground">
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <Lock className="h-4 w-4 text-cellpay-green" />
                <span>SSL Secured</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <ShieldCheck className="h-4 w-4 text-cellpay-green" />
                <span>PCI Compliant</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <CheckCircle2 className="h-4 w-4 text-cellpay-green" />
                <span>Verified Merchant</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center">
                <Headphones className="h-4 w-4 text-cellpay-green" />
                <span>24/7 Support</span>
              </div>
            </div>
          </div>

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
                  className={`rounded-lg border-2 py-2.5 px-2 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 min-h-[60px] ${
                    paymentMethod === m.key
                      ? "border-current text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-current bg-card"
                  }`}
                  style={paymentMethod === m.key ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                >
                  <m.Brand className="h-5 w-auto max-w-[60px]" />
                  <span className="text-[10px] leading-none">{m.label}</span>
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
              <select value={country} onChange={(e) => { setCountry(e.target.value); setRegionId(""); setRegionOther(false); }}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties}>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
                <option value="OTHER">Other</option>
              </select>
              <input type="text" placeholder="Street Address" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                {hasSubdivisions && !regionOther ? (
                  <select
                    value={regionId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__OTHER__") {
                        setRegionOther(true);
                        setRegionId("");
                      } else {
                        setRegionId(v);
                      }
                    }}
                    className="h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                  >
                    <option value="">State</option>
                    {subdivisions.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                    ))}
                    <option value="__OTHER__">Other…</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="State / Region"
                      value={regionId}
                      onChange={(e) => setRegionId(e.target.value.toUpperCase().slice(0, 10))}
                      maxLength={10}
                      className="h-11 w-full px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
                    />
                    {hasSubdivisions && regionOther && (
                      <button
                        type="button"
                        onClick={() => { setRegionOther(false); setRegionId(""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground underline"
                      >
                        list
                      </button>
                    )}
                  </div>
                )}
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

                {autoPay && (
                  <div className="rounded-lg bg-muted/40 p-4 space-y-3">
                    <p className="text-[12px] text-foreground leading-relaxed">
                      Choose auto pay for automatic recurring recharge every 30 days to save fees, you will be charged flat <span className="font-semibold">$4.97</span> fee for recharge amount.
                    </p>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={autoPayTerms} onChange={(e) => setAutoPayTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-input" style={{ accentColor: brandColor }} />
                      <span className="text-[12px] font-bold text-foreground">Accept Terms and Conditions</span>
                    </label>

                    <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 text-[11px] text-muted-foreground leading-relaxed space-y-2">
                      <p className="font-semibold text-foreground">GENERAL AND PAYMENT-SPECIFIC TERMS &amp; CONDITIONS; RECURRING CHARGE AUTHORIZATION</p>
                      <p>The following terms and conditions are specific to Auto Recharge payments and are supplemental to (and do not supersede) the Pay Cell Systems Service Agreement, which includes the General Terms and Conditions of Service (available at http://paycellsystems.com), that you received and accepted when you first became a Pay Cell Systems customer. Your continued access to or use of the Auto Recharge service after the receipt and review hereof constitutes your consent to the terms contained herein and your continued consent to the terms contained in the Service Agreement. You also continue to be bound by the terms of the Pay Cell Systems Privacy Policy, also available at http://paycellsystems.com, which details the conditions and circumstances under which, in the ordinary course of business, Pay Cell Systems may provide information concerning you or your account to third parties.</p>
                      <p>The following ''General Terms &amp; Conditions'' apply to all Auto Recharge Payment Options.</p>
                      <p className="font-semibold text-foreground">General Terms and Conditions (Applicable to ALL Auto Recharge Subscribers)</p>
                      <p className="font-semibold text-foreground">General Payment Information</p>
                      <p>A valid major credit card, debit card or electronic check (a ''Registered Payment Method'') must be registered and on file with Pay Cell Systems at all times to take advantage of automatic payments. Only one (1) card or account may be registered for any prepaid wireless telephone number. If an electronic check is returned for any reason, you will be charged a fee of $50 per check. There may be additional return fees up to the maximum allowed by law. If you need to change or update your payment information, please call Pay Cell Systems Customer Care dial 888-800-6111.</p>
                      <p className="font-semibold text-foreground">Billing Notifications</p>
                      <p>You will be automatically billed for the recurring payments corresponding to your Auto Recharge Payment Option as set forth under the applicable Payment-Specific Terms &amp; Conditions below until you affirmatively un-enroll from the Auto Recharge service in accordance with the section below entitled ''Cancelling Auto Recharge''. These recurring charges to your account are non-refundable. Pay Cell Systems will send an email confirmation and text message to Monthly Unlimited Plan Users to email address and or the phone number listed on your account. The text message or email will indicate whether the attempt to charge your Registered Payment Method was successful and, if so, how much was charged and when the charge was made. We will also send a notification within 24 hours before charging your account notifying the impending charge. Pay Cell Systems will not charge you for these notifications. By law, you also have the right to receive notice prior to any transfer that varies in amount from the previous transfer or from the amount set forth in the cover letter accompanying this document.</p>
                      <p className="font-semibold text-foreground">Adding Funds Manually</p>
                      <p>You can manually recharge your account by accessing the ''Recharge'' tab at http://paycellsystems.com with your credit card as well as by entering the PIN number on the refill card purchased at any Pay Cell Systems Retailer locations.</p>
                      <p className="font-semibold text-foreground">Cancelling Auto Recharge</p>
                      <p>To cancel the Auto Recharge service, you must affirmatively un-enroll by calling Pay Cell Systems Customer Care 888-800-6111 or by checking the appropriate ''Un-enroll'' box at http://paycellsystems.com/cancelautopay. Cancellation will become effective immediately. Account balance is not refundable or exchangeable, and is forfeited at expiration date. You will not receive a refund or credit for any fees charged against your account prior to cancellation. Pay Cell Systems will send a confirmation email and text message as listed on your account indicating whether un-enrollment was successful at no charge to you. You understand that by un-enrolling you will be terminating not only your selected Payment Option, but also your Auto Recharge service entirely. Switching to a new Payment Option will require you to re-enroll in the Auto Recharge service.</p>
                      <p className="font-semibold text-foreground">Questions and Errors</p>
                      <p>If you have questions about any electronic transfer, or if you believe there is an error regarding a transfer set forth in the email referred to in the section above entitled ''Billing; Notifications'', please call us as soon as possible 888-800-6111 or email us at support@paycellsystems.com. You are not liable for unauthorized electronic transfers, or for Pay Cell Systems failure to properly make or stop certain transfers as required; however, we must hear from you regarding the suspected problem or error no later than 5 days after we send the applicable email on which the problem or error appears. Your complaint or question should include the following information:</p>
                      <p>(1) Your name and account number;</p>
                      <p>(2) A description of the error or the transfer you are unsure about, and a clear explanation of why you believe it is an error or why you need more information; and</p>
                      <p>(3) The dollar amount of the suspected error.</p>
                      <p>If you tell us of your complaint or question over the phone, we may require that you follow up by sending us the relevant information in writing within 5 business days.</p>
                      <p>Within 7 business days after your call or our receipt of your written statement containing the information described above, we will attempt to determine whether an error has occurred and if it has, we will promptly correct the error. However, we may require up to 20 business days to investigate the matter (30 business days for new accounts or point-of-sale or foreign transactions). If we ask you to put your complaint or question in writing and we do not receive it within 10 business days, we may not credit your account. We will inform you of the results of our investigation within 3 business days after completion. If we determine there was an error, we will promptly credit the appropriate airtime or dollar amount to your account.</p>
                      <p className="font-semibold text-foreground">Payment-Specific Terms and Conditions; Recurring Charge Authorization</p>
                      <p>If you selected the Auto Recharge Payment Option when you enrolled in Auto Recharge, the following Payment-Specific Terms and Conditions and Recurring Charge Authorization apply to you.</p>
                      <p className="font-semibold text-foreground">Billing Frequency and Amount; Payment Failure; Account Interruption and Cancellation</p>
                      <p>You will be automatically billed for the fixed dollar amount set forth in the cover letter accompanying this document, until you affirmatively cancel from the Auto Recharge service or until service interruption, as described below. If you do not have sufficient funds in your account to make your monthly payment, your account will not be charged and your service will be interrupted. You will be required to manually add enough funds to your account to have your service restored, and upon restoration, your monthly payment anniversary date will then be based upon your date of restoration. If you don't make a full monthly payment within 30 days of any account interruption, you will lose all unused funds, your account will be canceled and you will lose your phone number.</p>
                    </div>

                  </div>
                )}
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
      {showSaveInfoTip && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveInfoTip(false)}>
          <div className="bg-foreground text-background rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm leading-relaxed text-center">
              You have opted to save your cc info on file for a faster future payment. Be sure to create an password after you have completed your purchase to pay with the saved bank card info next time. And you have opted to send text to pay message.
            </p>
            <div className="flex justify-center mt-4">
              <button type="button" onClick={() => setShowSaveInfoTip(false)}
                className="px-6 py-2 rounded-lg bg-background text-foreground font-bold text-sm">
                Got it
              </button>
            </div>
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
