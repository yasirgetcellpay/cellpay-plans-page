import { useState, useEffect } from "react";
import { viewCarrier } from "@/lib/cellpay-api";

export interface CarrierPlan {
  id?: string;
  price: string;
  highlight: string;
  plan_id?: string;
}

export interface RangeConfig {
  rangePlan: true;
  rangeMin: number;
  rangeMax: number;
}

export interface CarrierData {
  carrier?: {
    id?: number;
    name?: string;
    title?: string;
    slug?: string;
    carrierId?: number;
    [key: string]: unknown;
  };
  seo_carrier?: {
    carrier?: string;
    carrierId?: number;
    recommended?: { h1?: string; h2?: string };
    support_text?: { option1?: string };
    faqs?: Array<{ question: string; answer: string }>;
  };
  carrier_plans?: unknown;
  [key: string]: unknown;
}

const isRangeBased = (plans: unknown): plans is { rangePlan: boolean; carrier: { rangeMin: number; rangeMax: number } } =>
  typeof plans === "object" &&
  plans !== null &&
  "rangePlan" in plans &&
  (plans as Record<string, unknown>).rangePlan === true;

const isPlanArray = (plans: unknown): plans is Array<Record<string, unknown>> =>
  Array.isArray(plans) && plans.length > 0;

/**
 * Fetches carrier data from the CellPay API wrapper.
 * Handles both plan-based and range-based carriers.
 */
export const useCarrierData = (slug: string, staticPlans: CarrierPlan[] = []) => {
  const [data, setData] = useState<CarrierData | null>(null);
  const [plans, setPlans] = useState<CarrierPlan[]>(staticPlans);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setRange(null);

      try {
        if (!slug) {
          setData(null);
          setPlans(staticPlans);
          setError("Carrier data unavailable");
          return;
        }

        const result = await viewCarrier<CarrierData>(slug);

        if (cancelled) return;

        if (!result.success || !result.data) {
          setData(null);
          setPlans(staticPlans);
          setError(result.error || "Carrier data unavailable");
          return;
        }

        const carrierData = result.data;

        setData(carrierData);

        const apiPlans = carrierData.carrier_plans;

        // Range-based carrier (e.g. Boost Mobile — no fixed plans, user picks amount)
        if (isRangeBased(apiPlans)) {
          const { rangeMin, rangeMax } = apiPlans.carrier;
          setRange({ rangePlan: true, rangeMin, rangeMax });
          setPlans(staticPlans);
          return;
        }

        if (isPlanArray(apiPlans)) {
          const parsed: CarrierPlan[] = apiPlans.map((p) => ({
            price: `$${p.price || p.amount || "0"}`,
            highlight: (p.title || p.highlight || p.description || "Prepaid Refill") as string,
            plan_id: String(p.plan_id || p.id || ""),
          }));
          setPlans(parsed);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(`CellPay fetch failed for ${slug}:`, err);
          setData(null);
          setPlans(staticPlans);
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    data,
    plans,
    loading,
    error,
    range,
    carrierId: data?.carrier?.carrierId ?? data?.carrier?.id,
    seoCarrier: data?.seo_carrier,
  };
};
