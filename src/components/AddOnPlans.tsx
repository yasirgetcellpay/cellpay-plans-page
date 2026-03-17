interface AddOnProps {
  price: string;
  name: string;
  description: string;
  outlined?: boolean;
  priceColorClass?: string;
}

const AddOnCard = ({ price, name, description, outlined, priceColorClass = "text-cellpay-green" }: AddOnProps) => (
  <div className="border border-border rounded-lg p-6 flex flex-col items-center text-center bg-card">
    <div className={`${priceColorClass} text-3xl font-black mb-2`}>{price}</div>
    <h4 className="font-bold text-foreground mb-4">{name}</h4>
    <p className="text-sm text-muted-foreground mb-6">{description}</p>
    <a
      href="#"
      className={`mt-auto w-full py-2 rounded font-bold text-center block transition-colors ${
        outlined
          ? "border-2 border-cellpay-green text-cellpay-green hover:bg-cellpay-green hover:text-primary-foreground"
          : "bg-cellpay-green text-primary-foreground hover:bg-cellpay-green-hover"
      }`}
    >
      Select plan
    </a>
  </div>
);

export const AddOnPlans = () => {
  const addons: AddOnProps[] = [
    { price: "$5", name: "2GB High-Speed Data", description: "2GB High-Speed Data Add-On, Works with all plans, Expires with plan month" },
    { price: "$10", name: "5GB High-Speed Data", description: "5GB High-Speed Data Add-On, Works with all plans, Expires with plan month" },
    { price: "$10", name: "International Calling", description: "PayGo International Talk Add-On, Rollover: 180 days after last use, Works with all plans", outlined: true, priceColorClass: "text-foreground" },
    { price: "$20", name: "10GB High-Speed Data", description: "10GB High-Speed Data Add-On, Works with all plans, Expires with plan month" },
    { price: "$10", name: "Intl Calling Credit", description: "International Calling Credit, Use toward 100+ countries, Works with all plans", outlined: true, priceColorClass: "text-foreground" },
    { price: "$10", name: "1.5GB Tablet Data", description: "1.5GB 4G LTE Data, Compatible with tablets & laptops, Expires: 30 days" },
  ];

  return (
    <section className="bg-card py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-foreground mb-2">Add-On Plans</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Boost your plan with optional data, hotspot, or international add-ons. Compatible with all smartphone plans.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addons.map((a, i) => (
            <AddOnCard key={i} {...a} />
          ))}
        </div>
      </div>
    </section>
  );
};
