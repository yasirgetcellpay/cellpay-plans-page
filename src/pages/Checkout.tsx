import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2, CreditCard, Building2, Smartphone } from "lucide-react";
import { useCheckout } from "@/hooks/use-checkout";
import { getCarrierBrandColor } from "@/lib/carrier-colors";
import { PaymentBar } from "@/components/PaymentBar";
import { toast } from "sonner";

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
  const brandColor = getCarrierBrandColor(carrierSlug);
  const total = amount + PROCESSING_FEE;

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isFormValid =
    form.email &&
    form.firstName &&
    form.lastName &&
    form.billingPhone &&
    form.address &&
    form.city &&
    form.stateProvince &&
    form.zip &&
    agreeTerms &&
    (paymentMethod !== "cardpayment" || (form.ccNumber && form.expMonth && form.expYear && form.cvv));

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error("Please fill all required fields.");
      return;
    }

    const result = await processCheckout({
      payment_method: paymentMethod as CheckoutState["carrierSlug"] extends string ? "cardpayment" : "cardpayment",
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
        address: form.address,
        city: form.city,
        zip: form.zip,
        cc_type: "visa",
        cc_number: form.ccNumber,
        cc_exp_month: form.expMonth,
        cc_exp_year: form.expYear,
        cvv_number: form.cvv,
      },
      billing: {
        bill_email: form.email,
        country_id: "US",
        region_name: form.stateProvince,
      },
    });

    if (result?.success) {
      toast.success("Order placed successfully!");
    }
  };

  const paymentMethods = [
    { id: "cardpayment", label: "Credit Card", icon: CreditCard },
    { id: "plaid", label: "Pay by Bank", icon: Building2 },
    { id: "paypal", label: "Paypal", icon: () => <span className="text-lg font-bold text-blue-700">P</span> },
    { id: "googlepay", label: "Google Pay", icon: () => <span className="text-lg font-bold">G</span> },
    { id: "applepay", label: "Cash App Pay", icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 text-white" style={{ backgroundColor: brandColor }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link to="/" className="text-xl font-bold tracking-tight">
            cellpay<span className="align-super text-[10px]">®</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="hover:underline">Domestic Payments</Link>
            <span className="opacity-70">Bill Payments</span>
            <span className="opacity-70">International Topups</span>
          </div>
        </div>
      </nav>

      {/* Checkout header */}
      <div className="text-white py-4 text-center" style={{ backgroundColor: brandColor }}>
        <h1 className="text-2xl font-extrabold">Checkout</h1>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">Contact</h2>
              <label className="block text-sm text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="Enter Your Email..."
                className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
              />
              <label className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <input type="checkbox" className="h-4 w-4 rounded" />
                I am paying for someone else's account
              </label>
            </div>

            {/* Payment Options */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">Payment Options</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {paymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  const isActive = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        isActive ? "bg-white shadow-sm" : "bg-gray-50 border-transparent hover:border-gray-300"
                      }`}
                      style={isActive ? { borderColor: brandColor, color: brandColor } : {}}
                    >
                      <Icon className="h-5 w-5" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">Billing Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={form.firstName} onChange={handleChange("firstName")} placeholder="Enter Your First Name..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Last Name *</label>
                  <input type="text" value={form.lastName} onChange={handleChange("lastName")} placeholder="Enter Your Last Name..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">Bill Payer's Phone Number *</label>
                <input type="tel" value={form.billingPhone} onChange={handleChange("billingPhone")} placeholder="Enter Phone Number..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">Street Address *</label>
                <input type="text" value={form.address} onChange={handleChange("address")} placeholder="Enter Street Address..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">City *</label>
                  <input type="text" value={form.city} onChange={handleChange("city")} placeholder="Enter City..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">State/Province *</label>
                  <select value={form.stateProvince} onChange={handleChange("stateProvince")} className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 bg-white" style={{ "--tw-ring-color": brandColor } as React.CSSProperties}>
                    <option value="">Select One</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Country *</label>
                  <select className="w-full h-11 px-3 rounded border border-gray-300 text-sm bg-white" disabled>
                    <option>United States</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ZIP *</label>
                  <input type="text" value={form.zip} onChange={handleChange("zip")} placeholder="Enter Your ZIP..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                </div>
              </div>

              {/* Credit card fields */}
              {paymentMethod === "cardpayment" && (
                <>
                  <div className="mt-4">
                    <label className="block text-sm text-gray-600 mb-1">Credit Card Number *</label>
                    <input type="text" value={form.ccNumber} onChange={handleChange("ccNumber")} placeholder="Enter Your Card Number..." className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Expiration Month *</label>
                      <select value={form.expMonth} onChange={handleChange("expMonth")} className="w-full h-11 px-3 rounded border border-gray-300 text-sm bg-white" style={{ "--tw-ring-color": brandColor } as React.CSSProperties}>
                        <option value="">Month</option>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Expiration Year *</label>
                      <select value={form.expYear} onChange={handleChange("expYear")} className="w-full h-11 px-3 rounded border border-gray-300 text-sm bg-white" style={{ "--tw-ring-color": brandColor } as React.CSSProperties}>
                        <option value="">Year</option>
                        {Array.from({ length: 10 }, (_, i) => String(2025 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">CVV Code *</label>
                      <input type="text" value={form.cvv} onChange={handleChange("cvv")} placeholder="CVV..." maxLength={4} className="w-full h-11 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2" style={{ "--tw-ring-color": brandColor } as React.CSSProperties} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Terms */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-800 mb-3">Terms & Conditions</h2>
              <p className="text-xs text-gray-500 mb-1">I hereby authorize charges totaling <b>${total.toFixed(2)}</b> via my credit card.</p>
              <p className="text-xs text-gray-500 mb-4">I understand that charge on my credit card is not refundable under any circumstances.</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: brandColor }} />
                  I agree to <span className="underline" style={{ color: brandColor }}>Terms and Conditions</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={savePayment} onChange={(e) => setSavePayment(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: brandColor }} />
                  Save payment information for next time
                </label>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-center pb-4">
              <button
                type="button"
                disabled={!isFormValid || processing}
                onClick={handleSubmit}
                className="h-12 px-12 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                PLACE ORDER NOW
              </button>
            </div>
          </div>

          {/* Right column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-20">
              <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-3">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mobile No.</span>
                  <span className="font-medium text-gray-800">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Product</span>
                  <span className="font-medium text-gray-800">{carrierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Sent</span>
                  <span className="font-medium text-gray-800">${amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Processing Fee</span>
                  <span className="font-medium text-gray-800">${PROCESSING_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sale Tax</span>
                  <span className="font-medium text-gray-800">$0.00</span>
                </div>
              </div>
              <div
                className="mt-4 rounded-lg p-4 flex justify-between items-center text-white font-bold"
                style={{ backgroundColor: brandColor }}
              >
                <span>Total Charges</span>
                <span className="text-xl">${total.toFixed(2)}</span>
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
