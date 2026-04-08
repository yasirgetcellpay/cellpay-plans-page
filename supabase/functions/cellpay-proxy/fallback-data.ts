// Static fallback data used when CellPay API is blocked by Cloudflare
export const FALLBACK_CARRIERS = [
  { id: 1, name: "AT&T", slug: "att", logo: "", active: 1 },
  { id: 2, name: "T-Mobile", slug: "t-mobile", logo: "", active: 1 },
  { id: 3, name: "Verizon", slug: "verizon", logo: "", active: 1 },
  { id: 4, name: "Boost Mobile", slug: "boost", logo: "", active: 1 },
  { id: 5, name: "Cricket Wireless", slug: "cricket", logo: "", active: 1 },
  { id: 6, name: "Metro by T-Mobile", slug: "metro", logo: "", active: 1 },
  { id: 7, name: "Straight Talk", slug: "straight-talk", logo: "", active: 1 },
  { id: 8, name: "TracFone", slug: "tracfone", logo: "", active: 1 },
  { id: 9, name: "Net10 Wireless", slug: "net10", logo: "", active: 1 },
  { id: 10, name: "H2O Wireless", slug: "h2o", logo: "", active: 1 },
  { id: 11, name: "Lycamobile", slug: "lycamobile", logo: "", active: 1 },
  { id: 12, name: "Ultra Mobile", slug: "ultra-mobile", logo: "", active: 1 },
  { id: 13, name: "US Cellular", slug: "us-cellular", logo: "", active: 1 },
  { id: 14, name: "Page Plus", slug: "page-plus", logo: "", active: 1 },
  { id: 15, name: "Simple Mobile", slug: "simple-mobile", logo: "", active: 1 },
];

// Carrier detail fallbacks keyed by slug
export const FALLBACK_CARRIER_DETAILS: Record<string, unknown> = {
  boost: {
    success: true,
    data: {
      title_for_layout: "Boost Mobile",
      seo_carrier: {
        carrier: "Boost Mobile",
        carrierId: 4,
        recommended: { h1: "Boost Mobile Refill", h2: "Choose your plan" },
        support_text: { option1: "Call *611 from your Boost Mobile phone" },
        faqs: [
          { question: "How do I refill my Boost Mobile phone?", answer: "Enter your phone number, select a plan, and complete payment." },
          { question: "How long does it take?", answer: "Your refill is applied instantly after payment." },
        ],
      },
      carrier_plans: {
        rangePlan: true,
        carrier: {
          id: 4,
          carrierId: 4,
          name: "Boost Mobile",
          shortName: "boost",
          rangePlan: "66666",
          rangeMin: 5,
          rangeMax: 250,
        },
      },
    },
  },
  att: {
    success: true,
    data: {
      title_for_layout: "AT&T",
      seo_carrier: {
        carrier: "AT&T",
        carrierId: 1,
        recommended: { h1: "AT&T Prepaid Refill", h2: "Choose your plan" },
        faqs: [],
      },
      carrier_plans: [
        { plan_id: "att-25", price: "25", title: "$25 Prepaid Refill" },
        { plan_id: "att-35", price: "35", title: "$35 Prepaid Refill" },
        { plan_id: "att-45", price: "45", title: "$45 Prepaid Refill" },
        { plan_id: "att-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "att-65", price: "65", title: "$65 Prepaid Refill" },
        { plan_id: "att-75", price: "75", title: "$75 Prepaid Refill" },
      ],
    },
  },
  "t-mobile": {
    success: true,
    data: {
      title_for_layout: "T-Mobile",
      seo_carrier: {
        carrier: "T-Mobile",
        carrierId: 2,
        recommended: { h1: "T-Mobile Prepaid Refill", h2: "Choose your plan" },
        faqs: [],
      },
      carrier_plans: [
        { plan_id: "tmo-10", price: "10", title: "$10 Prepaid Refill" },
        { plan_id: "tmo-25", price: "25", title: "$25 Prepaid Refill" },
        { plan_id: "tmo-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "tmo-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "tmo-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "tmo-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
  verizon: {
    success: true,
    data: {
      title_for_layout: "Verizon",
      seo_carrier: {
        carrier: "Verizon",
        carrierId: 3,
        recommended: { h1: "Verizon Prepaid Refill", h2: "Choose your plan" },
        faqs: [],
      },
      carrier_plans: [
        { plan_id: "vz-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "vz-35", price: "35", title: "$35 Prepaid Refill" },
        { plan_id: "vz-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "vz-45", price: "45", title: "$45 Prepaid Refill" },
        { plan_id: "vz-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "vz-60", price: "60", title: "$60 Prepaid Refill" },
        { plan_id: "vz-70", price: "70", title: "$70 Prepaid Refill" },
      ],
    },
  },
  cricket: {
    success: true,
    data: {
      title_for_layout: "Cricket Wireless",
      seo_carrier: { carrier: "Cricket Wireless", carrierId: 5, recommended: { h1: "Cricket Wireless Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "cr-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "cr-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "cr-55", price: "55", title: "$55 Prepaid Refill" },
        { plan_id: "cr-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
  metro: {
    success: true,
    data: {
      title_for_layout: "Metro by T-Mobile",
      seo_carrier: { carrier: "Metro by T-Mobile", carrierId: 6, recommended: { h1: "Metro by T-Mobile Refill", h2: "Choose your plan" }, faqs: [] },
      carrier_plans: [
        { plan_id: "mt-30", price: "30", title: "$30 Prepaid Refill" },
        { plan_id: "mt-40", price: "40", title: "$40 Prepaid Refill" },
        { plan_id: "mt-50", price: "50", title: "$50 Prepaid Refill" },
        { plan_id: "mt-60", price: "60", title: "$60 Prepaid Refill" },
      ],
    },
  },
};

export const getFallbackCarrierDetail = (slug: string) => {
  return FALLBACK_CARRIER_DETAILS[slug] ?? {
    success: true,
    data: {
      title_for_layout: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      seo_carrier: {
        carrier: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        recommended: { h1: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Refill`, h2: "Choose your plan" },
        faqs: [],
      },
      carrier_plans: [
        { plan_id: `${slug}-25`, price: "25", title: "$25 Prepaid Refill" },
        { plan_id: `${slug}-30`, price: "30", title: "$30 Prepaid Refill" },
        { plan_id: `${slug}-50`, price: "50", title: "$50 Prepaid Refill" },
      ],
    },
  };
};
