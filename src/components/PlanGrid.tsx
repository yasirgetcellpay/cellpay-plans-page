interface Plan { price: string; highlight: string; popular?: boolean; }

interface PlanGridProps {
  plans: Plan[];
  brandColor: string;
  textOnBrand?: string;
  onSelect?: (plan: Plan) => void;
  popularIndex?: number;
}

export const PlanGrid = ({
  plans,
  brandColor,
  textOnBrand = "text-primary-foreground",
  onSelect,
  popularIndex,
}: PlanGridProps) => {
  const isOdd = plans.length % 2 !== 0;
  const gridPlans = isOdd ? plans.slice(0, -1) : plans;
  const lastPlan = isOdd ? plans[plans.length - 1] : null;

  const Card = ({ plan, idx }: { plan: Plan; idx: number }) => {
    const isPopular = plan.popular || idx === popularIndex;
    const handleClick = () => onSelect?.(plan);
    return (
      <div
        className={`relative bg-card border rounded-lg sm:rounded-xl overflow-hidden flex flex-col transition-all ${
          onSelect ? "cursor-pointer hover:shadow-lg active:scale-[0.98]" : ""
        } ${isPopular ? "ring-2 shadow-md" : "border-border"}`}
        style={isPopular ? { borderColor: brandColor, boxShadow: `0 0 0 2px ${brandColor}33` } : undefined}
        onClick={onSelect ? handleClick : undefined}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSelect && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {isPopular && (
          <div
            className="absolute top-0 right-0 z-10 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-primary-foreground rounded-bl-md"
            style={{ backgroundColor: brandColor }}
          >
            MOST POPULAR
          </div>
        )}
        <div className="h-[14px] sm:h-[24px]" />
        <div className={`px-2 py-1.5 sm:p-6 ${textOnBrand} text-center`} style={{ backgroundColor: brandColor }}>
          <span className="text-base sm:text-4xl font-extrabold">{plan.price}</span>
        </div>
        <div className="p-1.5 sm:p-6 flex-grow flex flex-col">
          <div
            className="bg-muted p-1 sm:p-3 rounded text-center font-bold text-[10px] sm:text-base mb-1.5 sm:mb-3 text-foreground"
            style={{ color: brandColor }}
          >
            {plan.highlight}
          </div>
          {/* "Tap to continue" only on touch (mobile) — feedback Page 7 #2 */}
          <p className="sm:hidden text-[10px] text-muted-foreground text-center mt-auto font-medium">
            {onSelect ? "Tap to continue" : ""}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {gridPlans.map((plan, i) => (
          <Card key={i} plan={plan} idx={i} />
        ))}
      </div>
      {lastPlan && (
        <div className="flex justify-center mt-2 sm:mt-4">
          <div className="w-[calc(50%-4px)] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-16px)]">
            <Card plan={lastPlan} idx={plans.length - 1} />
          </div>
        </div>
      )}
    </section>
  );
};
