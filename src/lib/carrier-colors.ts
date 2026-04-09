// Carrier brand color mapping using actual API slugs

const CARRIER_COLORS: Record<string, string> = {
  // AT&T
  "topup-at": "#009FDB",
  "topup-af": "#009FDB",
  // Boost Mobile
  "boost": "#F7941D",
  // Cricket Wireless
  "topup-crc": "#00843D",
  // H2O Wireless
  "h2o": "#0072CE",
  // Lyca Mobile
  "lyca": "#2E7D32",
  // Metro PCS
  "metropcs": "#6A2382",
  // NET10
  "net10": "#E94E0F",
  // Page Plus
  "pageplus": "#CD040B",
  "pageplusadd": "#CD040B",
  // Red Pocket Mobile
  "red-pocket-mobile": "#E4002B",
  // Simple Mobile
  "s1": "#48A23F",
  // T-Mobile
  "tmobile": "#E20074",
  // Total Wireless
  "total-wireless": "#E4002B",
  // Tracfone
  "tracfone": "#E4002B",
  // Ultra Mobile
  "ultra-mobile": "#5B2D8E",
  // US Cellular
  "us-cellular": "#003DA5",
  // Verizon
  "verizon": "#CD040B",
  "verizon-wireless-flexi": "#CD040B",
  // XBOX
  "xbox": "#107C10",
};

const DEFAULT_BRAND_COLOR = "#3B7A57";

export const getCarrierBrandColor = (slug: string): string => {
  if (!slug) return DEFAULT_BRAND_COLOR;
  return CARRIER_COLORS[slug.toLowerCase().trim()] ?? DEFAULT_BRAND_COLOR;
};
