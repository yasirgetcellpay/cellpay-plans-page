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
  <div className="plan-card bg-card border border-border rounded-xl overflow-hidden flex h-full flex-col">
    {badge ? (
      <div className={`${badgeColor} text-primary-foreground text-center py-1 text-xs font-bold uppercase tracking-widest`}>
        {badge}
      </div>
    ) : (
      <div className="h-[24px]" />
    )}
    <div className={`${headerColorClass} p-6 text-primary-foreground text-center`}>
      <h3 className="text-2xl font-extrabold">{name}</h3>
      <div className="mt-2">
        <span className="text-4xl font-extrabold">{price}</span>
        <span className="block text-sm opacity-90">/ Per 30 Days</span>
      </div>
    </div>
    <div className="p-6 flex-grow flex flex-col">
      <div className={`bg-muted p-3 rounded-lg text-center font-bold ${highlightColorClass} mb-6`}>
        {highlight}
      </div>
      <a href="#" className="w-full bg-cellpay-green text-primary-foreground text-center py-3 rounded font-bold mb-6 hover:bg-cellpay-green-hover block">
        Pay Now
      </a>
      <ul className="space-y-3 text-sm text-foreground mb-8">
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
    {
      name: "$50 Unlimited World",
      price: "$50.00",
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
      name: "$40 30GB Plan",
      price: "$40.00",
      headerColorClass: "bg-plan-tier3",
      highlight: "30GB High-Speed Data",
      highlightColorClass: "text-plan-tier3",
      features: [
        "30GB High-Speed Data", "15GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 125+ Countries", "Wi-Fi Calling",
      ],
    },
    {
      name: "$30 20GB Plan",
      price: "$30.00",
      headerColorClass: "bg-plan-tier4",
      highlight: "20GB High-Speed Data",
      highlightColorClass: "text-plan-tier4",
      features: [
        "20GB High-Speed Data", "20GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 125+ Countries", "Wi-Fi Calling",
      ],
    },
    {
      name: "$25 15GB Plan",
      price: "$25.00",
      headerColorClass: "bg-plan-tier4",
      highlight: "15GB High-Speed Data",
      highlightColorClass: "text-plan-tier4",
      features: [
        "15GB High-Speed Data", "15GB Mobile Hotspot", "5G Nationwide Access",
        "Unlimited Talk & Text", "Intl Calling to 100+ Countries", "Wi-Fi Calling",
      ],
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-foreground mb-2">30-Day Smartphone Plans</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          All plans include unlimited talk, text &amp; data. High-speed data reduced to 2G (64 kbps) after monthly allotment. Taxes &amp; fees not included.
        </p>
      </div>
      <div className="flex flex-wrap items-start justify-start gap-6">
        {plans.slice(0, 3).map((p) => (
          <div key={p.name} className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc((100%-3rem)/3)]">
            <PlanCard {...p} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-start justify-start gap-6">
        {plans.slice(3).map((p) => (
          <div key={p.name} className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc((100%-3rem)/3)]">
            <PlanCard {...p} />
          </div>
        ))}
      </div>
    </section>
  );
};
