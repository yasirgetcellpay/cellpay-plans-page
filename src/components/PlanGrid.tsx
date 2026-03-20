interface Plan { price: string; highlight: string; }

interface PlanGridProps {
  plans: Plan[];
  brandColor: string;
  textOnBrand?: string;
}

export const PlanGrid = ({ plans, brandColor, textOnBrand = "text-primary-foreground" }: PlanGridProps) => {
  const isOdd = plans.length % 2 !== 0;
  const gridPlans = isOdd ? plans.slice(0, -1) : plans;
  const lastPlan = isOdd ? plans[plans.length - 1] : null;

  const Card = ({ plan }: { plan: Plan }) => (
    <div className="bg-card border border-border rounded-lg sm:rounded-xl overflow-hidden flex flex-col">
      <div className="h-[14px] sm:h-[24px]" />
      <div className={`px-2 py-1.5 sm:p-6 ${textOnBrand} text-center`} style={{ backgroundColor: brandColor }}>
        <span className="text-base sm:text-4xl font-extrabold">{plan.price}</span>
      </div>
      <div className="p-1.5 sm:p-6 flex-grow flex flex-col">
        <div className="bg-muted p-1 sm:p-3 rounded text-center font-bold text-[9px] sm:text-base mb-1.5 sm:mb-6" style={{ color: brandColor }}>
          {plan.highlight}
        </div>
        <div className="flex justify-center mb-1.5 sm:mb-6">
          <a href="#" className={`${textOnBrand} text-center py-1 sm:py-3 px-4 sm:px-8 rounded font-bold text-[10px] sm:text-base hover:opacity-90 inline-block active:scale-[0.97] transition-all`} style={{ backgroundColor: brandColor }}>
            Pay Now
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {gridPlans.map((plan, i) => (
          <Card key={i} plan={plan} />
        ))}
      </div>
      {lastPlan && (
        <div className="flex justify-center mt-2 sm:mt-4 lg:justify-start">
          <div className="w-[calc(50%-4px)] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-16px)]">
            <Card plan={lastPlan} />
          </div>
        </div>
      )}
    </section>
  );
};
