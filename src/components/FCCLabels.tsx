interface FCCPlan {
  label: string;
  price: string;
  data: string;
  hotspot: string;
  network: string;
}

const fccPlans: FCCPlan[] = [
  { label: "$25 / 30 Days", price: "$25.00", data: "15GB", hotspot: "Included", network: "Verizon 5G" },
  { label: "$30 / 30 Days", price: "$30.00", data: "20GB", hotspot: "Included", network: "Verizon 5G" },
  { label: "$40 / 30 Days", price: "$40.00", data: "30GB", hotspot: "Included", network: "Verizon 5G" },
  { label: "$50 Unlimited World / 30 Days", price: "$50.00", data: "Unlimited", hotspot: "20GB", network: "Verizon 5G" },
  { label: "$60 Unlimited World+ / 30 Days", price: "$60.00", data: "Unlimited", hotspot: "30GB", network: "Verizon UWB" },
];

const FCCCard = ({ plan }: { plan: FCCPlan }) => {
  const rows = [
    ["Price", plan.price],
    ["Contract", "None"],
    ["High-Speed Data", plan.data],
    ["After Cap", "64 kbps"],
    ["Hotspot", plan.hotspot],
    ["Talk & Text", "Unlimited"],
    ["Network", plan.network],
  ];

  return (
    <div className="flex h-full flex-col rounded-sm border-2 border-foreground bg-card p-4">
      <div className="mb-3 flex min-h-[54px] items-center bg-cellpay-fcc-header p-3 text-[11px] font-bold leading-tight text-primary-foreground">
        {plan.label}
      </div>
      <div className="mb-3 border-b-4 border-foreground pb-2 text-xl font-black leading-none text-foreground">
        Broadband Facts
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="fcc-label-row flex items-start justify-between text-foreground">
          <span className="pr-3">{label}</span>
          <span className="text-right font-bold">{value}</span>
        </div>
      ))}
      <a href="#" className="mt-4 block rounded bg-cellpay-green py-2 text-center text-xs font-bold text-primary-foreground">
        Select plan
      </a>
    </div>
  );
};

export const FCCLabels = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="text-center mb-12">
      <h2 className="text-2xl font-extrabold text-foreground mb-2">All Plans FCC Broadband Facts Labels</h2>
      <p className="text-muted-foreground text-sm">
        The FCC requires us to display Broadband Facts labels for all service plans.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
      {fccPlans.map((p) => (
        <FCCCard key={p.label} plan={p} />
      ))}
    </div>
    <div className="mt-8 max-w-2xl mx-auto text-center text-[10px] text-muted-foreground">
      All plans are 30-day service plans. Data speeds reduced after monthly allotment. Taxes and fees not included.{" "}
      <a href="#" className="font-bold text-cellpay-green underline">
        View Full FCC Broadband Facts Labels
      </a>
    </div>
  </section>
);
