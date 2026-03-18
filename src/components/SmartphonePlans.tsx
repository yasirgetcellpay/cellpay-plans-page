interface PlanCardProps {
  name: string;
  price: string;
  badge?: string;
  badgeColor?: string;
  headerColorClass: string;
  highlight: string;
  highlightColorClass: string;
  features: string[];
}

const PlanCard = ({ name, price, badge, badgeColor, headerColorClass, highlight, highlightColorClass, features }: PlanCardProps) => (
  <div className="plan-card bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden flex h-full flex-col">
    {badge ? (
      <div className={`${badgeColor} text-primary-foreground text-center py-px sm:py-1 text-[8px] sm:text-xs font-bold uppercase tracking-widest`}>
        {badge}
      </div>
    ) : (
      <div className="h-[14px] sm:h-[24px]" />
    )}
    <div className={`${headerColorClass} px-2 py-1.5 sm:p-6 text-primary-foreground text-center`}>
      <span className="text-base sm:text-4xl font-extrabold">{price}</span>
      <span className="block text-[8px] sm:text-sm opacity-90">/ Per 30 Days</span>
    </div>
    <div className="p-1.5 sm:p-6 flex-grow flex flex-col">
      <div className={`bg-muted p-1 sm:p-3 rounded text-center font-bold text-[9px] sm:text-base ${highlightColorClass} mb-1.5 sm:mb-6`}>
        {highlight}
      </div>
      <a href="#" className="w-full bg-cellpay-green text-primary-foreground text-center py-1 sm:py-3 rounded font-bold text-[10px] sm:text-base mb-1.5 sm:mb-6 hover:bg-cellpay-green-hover block">
        Pay Now
      </a>
      <ul className="hidden sm:block space-y-3 text-sm text-foreground mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start">
            <span className="text-cellpay-green mr-2 font-bold">✓</span> {f}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const SmartphonePlans = () => {
  const plans: PlanCardProps[] = [
    {
      name: "$25 15GB Plan",
      price: "$25",
      headerColorClass: "bg-plan-tier4",
      highlight: "15GB High-Speed Data",
      highlightColorClass: "text-plan-tier4",
      features: [
        "15GB High-Speed Data", "15GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 100+ Countries", "Wi-Fi Calling",
      ],
    },
    {
      name: "$30 20GB Plan",
      price: "$30",
      headerColorClass: "bg-plan-tier4",
      highlight: "20GB High-Speed Data",
      highlightColorClass: "text-plan-tier4",
      features: [
        "20GB High-Speed Data", "20GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 125+ Countries", "Wi-Fi Calling",
      ],
    },
    {
      name: "$40 30GB Plan",
      price: "$40",
      headerColorClass: "bg-plan-tier3",
      highlight: "30GB High-Speed Data",
      highlightColorClass: "text-plan-tier3",
      features: [
        "30GB High-Speed Data", "15GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 125+ Countries", "Wi-Fi Calling",
      ],
    },
    {
      name: "$50 Unlimited World",
      price: "$50",
      badge: "Popular",
      badgeColor: "bg-cellpay-green",
      headerColorClass: "bg-plan-tier2",
      highlight: "Unlimited High-Speed Data",
      highlightColorClass: "text-plan-tier2",
      features: [
        "Unlimited High-Speed Data", "20GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 200+ Countries", "Intl Roaming in 17 Countries",
        "Wi-Fi Calling",
      ],
    },
    {
      name: "$60 Unlimited World+",
      price: "$60.00",
      badge: "Best Value",
      badgeColor: "bg-badge-best",
      headerColorClass: "bg-plan-tier1",
      highlight: "✦ Unlimited 5G Ultra Wideband",
      highlightColorClass: "text-plan-tier1",
      features: [
        "Unlimited High-Speed Data", "30GB Mobile Hotspot", "5G Ultra Wideband Access",
        "Unlimited Talk & Text", "Intl Calling to 200+ Countries", "Intl Roaming in 140+ Countries",
        "50GB Cloud Storage", "Wi-Fi Calling",
      ],
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-2 sm:pt-10 pb-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
        {plans.map((p) => (
          <PlanCard key={p.name} {...p} />
        ))}
      </div>
    </section>
  );
};
