import { useLocation, useNavigate } from "react-router-dom";
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

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardZip, setCardZip] = useState("");
  const [cardName, setCardName] = useState("");
  const [email, setEmail] = useState("");

  // Checkout config from API
  const [checkoutConfig, setCheckoutConfig] = useState<Record<string, unknown> | null>(null);

  // Success / error dialogs
  const [successData, setSuccessData] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Klarna
  const klarnaContainerRef = useRef<HTMLDivElement>(null);
  const [klarnaReady, setKlarnaReady] = useState(false);
  const [klarnaToken, setKlarnaToken] = useState<string | null>(null);

  useEffect(() => {
    if (!state) { navigate("/"); return; }
    (async () => {
      try {
        const [result, config] = await Promise.all([
          validateRecharge(
            state.carrierSlug,
            state.phone.replace(/\D/g, ""),
            state.planId,
            state.planId ? undefined : Number(state.amount)
          ),
          fetchCheckoutConfig().catch(() => null),
        ]);
        if (result.success === false) {
          toast({ title: "Validation failed", description: result.message || "Unable to validate this recharge", variant: "destructive" });
          navigate(-1);
          return;
        }
        setValidation(result);
        if (config) setCheckoutConfig(config);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Validation failed";
        toast({ title: "Error", description: msg, variant: "destructive" });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    cardName.trim().length > 0 &&
    email.includes("@");

  const canSubmit = agreedTerms && !submitting && (paymentMethod === "card" ? isCardValid : true);

  const handleResult = (result: Record<string, unknown>) => {
    const status = (String(result.status || "")).toLowerCase();
    if (status === "success" || status === "completed") {
      setSuccessData(result);
    } else {
      setErrorMsg((result.msg as string) || (result.message as string) || "Transaction failed");
    }
  };

  // ─── Credit Card ───
  const handleCard = async () => {
    const payload = {
      ...basePayload(),
      payment_method: "credit_card",
      cc_number: cardDigits,
      cc_exp_month: expiryDigits.slice(0, 2),
      cc_exp_year: "20" + expiryDigits.slice(2),
      cc_cvv: cardCvv,
      cc_type: detectCardType(cardDigits),
      bill_zip: cardZip,
      bill_name: cardName,
      bill_email: email,
      country_id: "US",
      region: cardZip,
      checkout_version: "5.0",
    };
    const result = await submitTransaction(payload) as Record<string, unknown>;
    handleResult(result);
  };

  // ─── PayPal ───
  const handlePayPal = async () => {
    const orderData = await createPayPalOrder(basePayload()) as Record<string, unknown>;
    const approvalUrl = (orderData.approval_url || orderData.approve_url) as string;
    if (!approvalUrl) { setErrorMsg("Could not initiate PayPal payment"); return; }

    const w = 500, h = 650;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    const popup = window.open(approvalUrl, "PayPalPopup", `width=${w},height=${h},left=${left},top=${top}`);

    const poll = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(poll);
        try {
          const captureResult = await capturePayPalOrder({ order_id: orderData.order_id || orderData.id }) as Record<string, unknown>;
          handleResult(captureResult);
        } catch {
          setErrorMsg("Payment was cancelled or failed");
        }
        setSubmitting(false);
      }
    }, 1000);
    return; // keep submitting true until popup closes
  };

  // ─── Plaid (Pay by Bank) ───
  const handlePlaid = async () => {
    try {
      await loadScript("https://cdn.plaid.com/link/v2/stable/link-initialize.js", "plaid-sdk");
    } catch {
      setErrorMsg("Failed to load Plaid SDK");
      return;
    }

    const tokenResp = await createPlaidLinkToken(basePayload()) as Record<string, unknown>;
    const linkToken = (tokenResp.link_token || ((tokenResp as Record<string, unknown>).data as Record<string, unknown> | undefined)?.link_token) as string;
    if (!linkToken) { setErrorMsg("Could not create Plaid link"); return; }

    if (!window.Plaid) { setErrorMsg("Plaid SDK not available"); return; }

    return new Promise<void>((resolve) => {
      const handler = window.Plaid!.create({
        token: linkToken,
        onSuccess: async (publicToken: string, metadata: Record<string, unknown>) => {
          try {
            const exchangeResult = await exchangePlaidToken({
              ...basePayload(),
              public_token: publicToken,
              account_id: (metadata.accounts as Array<Record<string, unknown>>)?.[0]?.id,
              payment_method: "plaid",
              checkout_version: "5.0",
            }) as Record<string, unknown>;
            handleResult(exchangeResult);
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

    const client = new window.google.payments.api.PaymentsClient({ environment: "PRODUCTION" });
    const baseCardMethod = {
      type: "CARD",
      parameters: { allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"], allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX", "DISCOVER"] },
    };

    const ready = await client.isReadyToPay({ apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [baseCardMethod] });
    if (!ready.result) { setErrorMsg("Google Pay is not available on this device"); return; }

    const merchantId = (checkoutConfig?.google_pay_merchant_id || checkoutConfig?.googlePayMerchantId || "") as string;
    const paymentData = await client.loadPaymentData({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{
        ...baseCardMethod,
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: { gateway: "cellpay", gatewayMerchantId: merchantId },
        },
      }],
      transactionInfo: { totalPriceStatus: "FINAL", totalPrice: String(total), currencyCode: "USD", countryCode: "US" },
      merchantInfo: { merchantId, merchantName: "CellPay" },
    });

    const tokenStr = (paymentData.paymentMethodData as Record<string, unknown>)?.tokenizationData as Record<string, unknown>;
    const result = await submitTransaction({
      ...basePayload(),
      payment_method: "google_pay",
      google_pay_token: tokenStr?.token,
      checkout_version: "5.0",
    }) as Record<string, unknown>;
    handleResult(result);
  };

  // ─── Apple Pay ───
  const handleApplePay = async () => {
    if (!window.ApplePaySession || !window.ApplePaySession.canMakePayments()) {
      setErrorMsg("Apple Pay is not available on this device. Please use Safari on a supported Apple device.");
      return;
    }

    const session = new window.ApplePaySession!(3, {
      countryCode: "US",
      currencyCode: "USD",
      supportedNetworks: ["visa", "masterCard", "amex", "discover"],
      merchantCapabilities: ["supports3DS"],
      total: { label: "CellPay Recharge", amount: String(total) },
    });

    session.onvalidatemerchant = async (event) => {
      try {
        const merchantSession = await createApplePaySession({ validationURL: event.validationURL }) as Record<string, unknown>;
        session.completeMerchantValidation(merchantSession.data || merchantSession);
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

        const result = await submitTransaction({
          ...basePayload(),
          payment_method: "apple_pay",
          apple_pay_token: btoa(JSON.stringify(tokenData)),
          apple_pay_billing_contact: JSON.stringify(billingContact),
          checkout_version: "5.0",
        }) as Record<string, unknown>;

        const status = String(result.status || "").toLowerCase();
        if (status === "success" || status === "completed") {
          session.completePayment({ status: session.STATUS_SUCCESS });
          setSuccessData(result);
        } else {
          session.completePayment({ status: session.STATUS_FAILURE });
          setErrorMsg((result.msg as string) || "Apple Pay transaction failed");
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
  const handleKlarna = async () => {
    if (klarnaToken) {
      // Already authorized, submit
      const result = await submitTransaction({
        ...basePayload(),
        payment_method: "klarna",
        klarna_auth_token: klarnaToken,
        bill_email: email || "customer@cellpay.us",
        checkout_version: "5.0",
      }) as Record<string, unknown>;
      handleResult(result);
      return;
    }

    try {
      await loadScript("https://x.klarnacdn.net/kp/lib/v1/api.js", "klarna-sdk");
    } catch {
      setErrorMsg("Failed to load Klarna SDK");
      return;
    }

    const sessionResp = await createKlarnaSession({
      ...basePayload(),
      amount: total, // dollars, not cents
    }) as Record<string, unknown>;

    const sessionData = (sessionResp.data || sessionResp) as Record<string, unknown>;
    const clientToken = sessionData.client_token as string;
    if (!clientToken) { setErrorMsg("Could not create Klarna session"); return; }

    if (!window.Klarna) { setErrorMsg("Klarna SDK not available"); return; }

    window.Klarna.Payments.init({ client_token: clientToken });

    return new Promise<void>((resolve) => {
      window.Klarna!.Payments.authorize(
        { payment_method_category: "pay_later" },
        { billing_address: { country: "US" } },
        async (res) => {
          if (res.approved && res.authorization_token) {
            setKlarnaToken(res.authorization_token);
            try {
              const result = await submitTransaction({
                ...basePayload(),
                payment_method: "klarna",
                klarna_auth_token: res.authorization_token,
                bill_email: email || "customer@cellpay.us",
                checkout_version: "5.0",
              }) as Record<string, unknown>;
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

  // ─── Cash App ───
  const handleCashApp = async () => {
    // Cash App Pay via Pockyt integration
    const result = await submitTransaction({
      ...basePayload(),
      payment_method: "cashapp",
      checkout_version: "5.0",
    }) as Record<string, unknown>;

    // The backend should return a redirect URL or process directly
    const redirectUrl = (result.redirect_url || result.cashapp_url) as string;
    if (redirectUrl) {
      const w = 500, h = 650;
      const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
      const popup = window.open(redirectUrl, "CashAppPay", `width=${w},height=${h},left=${left},top=${top}`);

      const poll = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(poll);
          // Check transaction status
          toast({ title: "Cash App Pay", description: "Please check your order status." });
          setSubmitting(false);
        }
      }, 1000);
      return;
    }
    handleResult(result);
  };

  // ─── Main handler ───
  const handlePlaceOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      switch (paymentMethod) {
        case "card": await handleCard(); break;
        case "paypal": await handlePayPal(); return; // returns early, keeps submitting
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
              <input type="text" placeholder="Cardholder Name" value={cardName} onChange={(e) => setCardName(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <input type="text" placeholder="Card Number" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19}
                className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="CVV" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                <input type="text" placeholder="ZIP" value={cardZip} onChange={(e) => setCardZip(e.target.value.replace(/\D/g, "").slice(0, 5))} maxLength={5}
                  className="h-11 px-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
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

            <p className="text-center text-[10px] text-muted-foreground">
              Secure payment powered by CellPay. Instant refill sent directly to your phone.
            </p>
          </div>
        </div>
      )}

      {/* Success dialog */}
      {successData && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => { setSuccessData(null); navigate("/"); }}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground mb-1">Your {state.carrierName} recharge has been processed.</p>
            {successData.transaction_id && (
              <p className="text-xs text-muted-foreground">Transaction ID: <span className="font-mono font-bold">{String(successData.transaction_id)}</span></p>
            )}
            <button type="button" onClick={() => { setSuccessData(null); navigate("/"); }}
              className="mt-4 px-6 py-2 rounded-lg text-primary-foreground font-bold text-sm" style={{ backgroundColor: brandColor }}>
              Done
            </button>
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
    </div>
  );
};

export default Checkout;
