import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { useCheckout } from "@/hooks/use-checkout";
import { PaymentBar } from "@/components/PaymentBar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  { id: "applepay", label: "Cash App Pay", icon: "💲" },
  { id: "klarna", label: "Klarna", subtitle: "(Buy now, pay later)", icon: "K" },
];

const getPaymentMethodLabel = (id: string) => {
  return paymentMethods.find((pm) => pm.id === id)?.label || "credit card";
};

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CheckoutState | null;
  const { processCheckout, processing } = useCheckout();

  const [paymentMethod, setPaymentMethod] = useState<string>("cardpayment");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    billingPhone: "",
    address: "",
    city: "",
    stateProvince: "",
    zip: "",
    ccNumber: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [savePayment, setSavePayment] = useState(false);

  // Plaid integration
  const [plaidPublicToken, setPlaidPublicToken] = useState<string | null>(null);
  const [plaidBankName, setPlaidBankName] = useState<string | null>(null);
  const [plaidInstitutions, setPlaidInstitutions] = useState<any[]>([]);
  const [plaidSearchQuery, setPlaidSearchQuery] = useState("");
  const [plaidLoadingInstitutions, setPlaidLoadingInstitutions] = useState(false);
  const [plaidSelectedToken, setPlaidSelectedToken] = useState<string | null>(null);
  const [plaidConnecting, setPlaidConnecting] = useState(false);

  // Fetch initial bank list
  useEffect(() => {
    if (paymentMethod === "plaid" && plaidInstitutions.length === 0) {
      setPlaidLoadingInstitutions(true);
      supabase.functions.invoke("plaid-link-token", {
        body: { action: "institutions_get", count: 16 },
      }).then(({ data }) => {
        if (data?.institutions) setPlaidInstitutions(data.institutions);
      }).catch(console.error).finally(() => setPlaidLoadingInstitutions(false));
    }
  }, [paymentMethod]);

  // Search institutions with debounce
  useEffect(() => {
    if (paymentMethod !== "plaid") return;
    if (!plaidSearchQuery.trim()) {
      // Re-fetch default list when search cleared
      supabase.functions.invoke("plaid-link-token", {
        body: { action: "institutions_get", count: 16 },
      }).then(({ data }) => {
        if (data?.institutions) setPlaidInstitutions(data.institutions);
      });
      return;
    }
    const timer = setTimeout(async () => {
      setPlaidLoadingInstitutions(true);
      try {
        const { data } = await supabase.functions.invoke("plaid-link-token", {
          body: { action: "institutions_search", query: plaidSearchQuery },
        });
        if (data?.institutions) setPlaidInstitutions(data.institutions);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setPlaidLoadingInstitutions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [plaidSearchQuery, paymentMethod]);

  // When user clicks a bank, create a generic link token (no institution_id) and open Plaid Link
  const handleBankClick = async (_institutionId: string) => {
    setPlaidConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("plaid-link-token", {
        body: { user_id: "checkout-user" },
      });
      if (error) throw error;
      if (data?.link_token) {
        setPlaidSelectedToken(data.link_token);
      }
    } catch (err) {
      console.error("Plaid token error:", err);
      toast.error("Could not connect to this bank.");
      setPlaidConnecting(false);
    }
  };

  const onPlaidSuccess = useCallback((publicToken: string, metadata: any) => {
    setPlaidPublicToken(publicToken);
    setPlaidBankName(metadata?.institution?.name || "Bank account");
    setPlaidConnecting(false);
    toast.success(`Connected to ${metadata?.institution?.name || "your bank"}!`);
  }, []);

  const { open: openPlaid, ready: plaidLinkReady } = usePlaidLink({
    token: plaidSelectedToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setPlaidConnecting(false),
  });

  // Auto-open when token is ready for selected bank
  useEffect(() => {
    if (plaidSelectedToken && plaidLinkReady) {
      openPlaid();
    }
  }, [plaidSelectedToken, plaidLinkReady, openPlaid]);


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

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const needsBillingForm = paymentMethod === "cardpayment";
  const isFormValid =
    form.email &&
    agreeTerms &&
    (needsBillingForm
      ? form.firstName && form.lastName && form.billingPhone && form.address && form.city && form.stateProvince && form.zip && form.ccNumber && form.expMonth && form.expYear && form.cvv
      : true);

  const detectCardType = (num: string): string => {
    const d = num.replace(/\D/g, "");
    if (/^4/.test(d)) return "visa";
    if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5)/.test(d)) return "discover";
    return "visa";
  };

  const buildPayload = (): import("@/services/apiWrapper").CheckoutPayload => {
    const base = {
      amount,
      total,
      phone_number: phone,
      carrierId,
      plan_id: planId,
      slug: carrierSlug,
      payment: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
      },
    };

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
        return {
          ...base,
          payment_method: "plaid",
          ...(plaidPublicToken ? { plaid_token: plaidPublicToken } : {}),
        };

      case "paypal":
        return { ...base, payment_method: "paypal" };

      case "googlepay":
        return { ...base, payment_method: "googlepay", google_pay_token: "" };

      case "applepay":
        return { ...base, payment_method: "pockyt" };

      case "klarna":
        return { ...base, payment_method: "klarna" as any };

      default:
        return { ...base, payment_method: "cardpayment" };
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (paymentMethod === "plaid" && !plaidPublicToken) {
      toast.error("Please connect your bank account first.");
      return;
    }

    const payload = buildPayload();
    const result = await processCheckout(payload);

    if (result?.success) {
      toast.success("Order placed successfully!");
    }
  };

  const inputClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";
  const selectClass = "w-full h-11 px-3 rounded border border-gray-300 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased flex flex-col">
      {/* Dark nav bar */}
      <nav className="sticky top-0 z-50 text-white" style={{ backgroundColor: NAV_COLOR }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <Link to="/" className="text-lg font-bold tracking-tight">
            cellpay<span className="align-super text-[9px]">®</span>
          </Link>
          <div className="hidden sm:flex items-center gap-5 text-xs font-medium">
            <Link to="/" className="hover:underline">Domestic Payments</Link>
            <span className="opacity-70">Bill Payments</span>
            <span className="opacity-70">International Topups</span>
            <span className="opacity-70">SIM Cards</span>
            <span className="opacity-70">Promotions</span>
          </div>
        </div>
      </nav>

      {/* Red checkout banner */}
      <div className="text-white py-5" style={{ backgroundColor: ACCENT_RED }}>
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-2xl font-extrabold tracking-wide">Checkout</h1>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left column - Form */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Contact */}
            <section className="bg-white rounded border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Contact</h2>
              <label className={labelClass}>Email *</label>
              <input type="email" value={form.email} onChange={handleChange("email")} placeholder="Enter Your Email..." className={inputClass} />
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
                        isActive
                          ? "border-red-500 bg-white text-red-600"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl leading-none shrink-0">{pm.icon}</span>
                      <div>
                        <span className="text-sm font-medium">{pm.label}</span>
                        {pm.subtitle && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">{pm.subtitle}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Dynamic content based on payment method */}
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
                    <select className={selectClass} disabled>
                      <option>United States</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>ZIP *</label>
                    <input type="text" value={form.zip} onChange={handleChange("zip")} placeholder="Enter Your ZIP..." className={inputClass} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelClass}>Credit Card Number *</label>
                  <input type="text" value={form.ccNumber} onChange={handleChange("ccNumber")} placeholder="Enter Your Card Number..." className={inputClass} />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className={labelClass}>Expiration Month*</label>
                    <select value={form.expMonth} onChange={handleChange("expMonth")} className={selectClass}>
                      <option value="">Month</option>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Expiration Year *</label>
                    <select value={form.expYear} onChange={handleChange("expYear")} className={selectClass}>
                      <option value="">Year</option>
                      {Array.from({ length: 10 }, (_, i) => String(2025 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>CVV Code *</label>
                    <input type="text" value={form.cvv} onChange={handleChange("cvv")} placeholder="CVV..." maxLength={4} className={inputClass} />
                  </div>
                </div>
              </section>
            )}

            {paymentMethod === "plaid" && (
              <section className="bg-white rounded border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Select your institution</h2>
                <p className="text-xs text-gray-400 mb-4">Powered by Plaid</p>

                {plaidBankName ? (
                  <div className="text-center space-y-3 py-4">
                    <div className="text-green-600 text-4xl">✓</div>
                    <p className="text-lg font-bold text-gray-800">Connected to {plaidBankName}</p>
                    <p className="text-sm text-gray-500">Your bank account is linked and ready for payment.</p>
                    <button
                      type="button"
                      onClick={() => { setPlaidPublicToken(null); setPlaidBankName(null); setPlaidSelectedToken(null); }}
                      className="text-sm text-red-500 underline hover:text-red-700"
                    >
                      Change bank
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative mb-4">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                      <input
                        type="text"
                        placeholder="Search"
                        value={plaidSearchQuery}
                        onChange={(e) => setPlaidSearchQuery(e.target.value)}
                        className="w-full h-12 pl-10 pr-3 rounded-lg border border-gray-300 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>

                    {/* Bank grid */}
                    {plaidLoadingInstitutions ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading banks...
                      </div>
                    ) : plaidInstitutions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                        {plaidInstitutions.map((inst: any) => (
                          <button
                            key={inst.institution_id}
                            type="button"
                            disabled={plaidConnecting}
                            onClick={() => handleBankClick(inst.institution_id)}
                            className="flex items-center justify-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all bg-white min-h-[80px] cursor-pointer disabled:opacity-50"
                          >
                            {inst.logo ? (
                              <img
                                src={`data:image/png;base64,${inst.logo}`}
                                alt={inst.name}
                                className="h-10 w-auto max-w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-gray-700">{inst.name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-gray-400 py-8">No banks found</p>
                    )}

                    {plaidConnecting && (
                      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting to your bank...
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 font-medium tracking-wide">🔒 PLAID</span>
                  <a href="https://plaid.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 hover:text-gray-700">What is Plaid?</a>
                </div>
              </section>
            )}

            {paymentMethod === "paypal" && (
              <section className="bg-gray-100 rounded-lg p-6 space-y-5">
                <button className="w-full h-14 rounded-lg font-bold text-lg" style={{ backgroundColor: "#FFC439", color: "#003087" }}>
                  PayPal
                </button>
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-2">Service Agreement</h3>
                  <p className="text-sm text-gray-500">
                    Service provided by cellpay not associated with any carrier, by agreeing with this you are authorizing us to make payment behalf of you to carrier
                  </p>
                </div>
              </section>
            )}

            {/* Terms & Conditions */}
            <section className="bg-white rounded border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Terms & Conditions</h2>
              <p className="text-xs text-gray-500 mb-1">
                I hereby authorize charges totaling <b>${total.toFixed(2)}</b> via my {pmLabel}.
              </p>
              <p className="text-xs text-gray-500 mb-4">
                I understand that charge on my {pmLabel} is not refundable under any circumstances.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: ACCENT_RED }} />
                  {paymentMethod === "paypal"
                    ? <span>I agree to <span className="underline text-blue-600">term & condition</span> and <span className="underline text-blue-600">service agreement</span></span>
                    : <span>I agree to <span className="underline text-blue-600">Terms and Conditions</span></span>
                  }
                </label>
                {paymentMethod === "cardpayment" && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={savePayment} onChange={(e) => setSavePayment(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: ACCENT_RED }} />
                    Save payment information for next time
                  </label>
                )}
              </div>
            </section>

            {/* Submit */}
            <div className="flex justify-center pb-4">
              <button
                type="button"
                disabled={!isFormValid || processing}
                onClick={handleSubmit}
                className="h-12 px-10 rounded text-white font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                style={{ backgroundColor: ACCENT_RED }}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                PLACE ORDER NOW
              </button>
            </div>
          </div>

          {/* Right column - Order Summary (sticky) */}
          <div className="w-full md:w-[340px] shrink-0 order-first md:order-last">
            <div className="bg-white rounded border border-gray-200 sticky top-16">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="text-sm font-bold text-gray-800">Order Summary</h2>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between px-5 py-3 text-sm">
                  <span className="text-gray-500">Mobile No.</span>
                  <span className="font-semibold text-gray-800">
                    {phone.length === 10
                      ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
                      : phone}
                  </span>
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
              <div
                className="mx-4 mb-4 mt-2 rounded-lg px-5 py-4 flex justify-between items-center text-white"
                style={{ backgroundColor: ACCENT_RED }}
              >
                <span className="text-sm font-bold">Total Charges</span>
                <span className="text-xl font-extrabold">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PaymentBar />
      <footer className="bg-gray-900 text-gray-400 py-6 text-center text-xs">
        <p>© 2026 All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Checkout;
