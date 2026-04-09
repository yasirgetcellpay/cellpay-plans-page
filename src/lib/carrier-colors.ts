// Carrier brand color mapping
// Maps carrier slugs to their brand colors for dynamic theming

const CARRIER_COLORS: Record<string, string> = {
  // Orange carriers
  "boost": "#F7941D",
  "boost-mobile": "#F7941D",
  // Blue carriers
  "topup-at": "#009FDB",
  "at-t-prepaid": "#009FDB",
  "att": "#009FDB",
  "h2o": "#0072CE",
  "h2o-wireless": "#0072CE",
  "cricket": "#00843D",
  "cricket-wireless": "#00843D",
  // Green carriers
  "lyca": "#2E7D32",
  "lycamobile": "#2E7D32",
  "mint": "#00B140",
  "mint-mobile": "#00B140",
  "simple-mobile": "#48A23F",
  // Magenta/Pink carriers
  "tmobile": "#E20074",
  "t-mobile": "#E20074",
  "metro": "#6A2382",
  "metro-by-t-mobile": "#6A2382",
  // Red carriers
  "verizon": "#CD040B",
  "page-plus": "#CD040B",
  "straight-talk": "#CD040B",
  "tracfone": "#E4002B",
  "net10": "#E94E0F",
  // Purple carriers
  "ultra": "#5B2D8E",
  "ultra-mobile": "#5B2D8E",
  // Other
  "gophone": "#FF6900",
  "liberty": "#0033A0",
  "good2go": "#F7941D",
  "telcel": "#003DA5",
  "claro": "#DA291C",
};

// Default green used when no specific brand color is found
const DEFAULT_BRAND_COLOR = "#3B7A57";

export const getCarrierBrandColor = (slug: string): string => {
  if (!slug) return DEFAULT_BRAND_COLOR;
  const normalized = slug.toLowerCase().trim();
  
  // Direct match
  if (CARRIER_COLORS[normalized]) return CARRIER_COLORS[normalized];
  
  // Partial match
  for (const [key, color] of Object.entries(CARRIER_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) return color;
  }
  
  return DEFAULT_BRAND_COLOR;
};
