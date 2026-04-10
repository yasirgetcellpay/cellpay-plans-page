interface Plan { price: string; highlight: string; plan_id?: string; }

interface PlanGridProps {
  plans: Plan[];
  brandColor?: string;
  onSelect?: (plan: Plan) => void;
  loading?: boolean;
  selectedPlanId?: string;
}

export const PlanGrid = ({ plans, brandColor = "hsl(134, 40%, 40%)", onSelect, loading, selectedPlanId }: PlanGridProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  if (!plans.length) return null;

  return (
    <div>
      <p className="text-sm font-bold text-gray-900 mb-3">Select Amount</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {plans.map((plan, i) => {
          const isSelected = selectedPlanId === plan.plan_id;
          return (
            <button
              key={plan.plan_id || i}
              type="button"
              onClick={() => onSelect?.(plan)}
              className={`border rounded-lg overflow-hidden text-left transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-offset-1" : ""
              }`}
              style={isSelected ? { borderColor: brandColor, outlineColor: brandColor } : {}}
            >
              <div
                className="px-3 py-2.5 sm:py-3 text-center text-white font-extrabold text-base sm:text-lg"
                style={{ backgroundColor: brandColor }}
              >
                {plan.price}
              </div>
              <div className="px-2 py-2 sm:px-3 sm:py-3 min-h-[48px] sm:min-h-[64px] flex items-start">
                <p className="text-[10px] sm:text-xs leading-tight text-gray-600 line-clamp-4">
                  {plan.highlight}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
