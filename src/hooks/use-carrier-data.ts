import { useState, useEffect } from "react";
import { viewCarrier } from "@/lib/cellpay-api";

export interface CarrierPlan {
  id?: string;
  price: string;
  highlight: string;
  plan_id?: string;
}

export interface CarrierData {
  carrier?: {
    id?: number;
    name?: string;
    slug?: string;
    [key: string]: unknown;
  };
  carrier_plans?: Array<{
    id?: string | number;
    plan_id?: string;
    title?: string;
    price?: string | number;
    amount?: string | number;
    highlight?: string;
    description?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Fetches carrier data from the CellPay API (client-side).
 * Falls back to provided staticPlans if the API fails.
 */
export const useCarrierData = (slug: string, staticPlans: CarrierPlan[]) => {
  const [data, setData] = useState<CarrierData | null>(null);
  const [plans, setPlans] = useState<CarrierPlan[]>(staticPlans);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const result = (await viewCarrier(slug)) as { success?: boolean; data?: CarrierData };

        if (cancelled) return;

        const carrierData = result?.data ?? (result as unknown as CarrierData);
        if (!carrierData) {
          setError("Carrier data unavailable");
          return;
        }

        setData(carrierData);

        const apiPlans = carrierData.carrier_plans;
        if (Array.isArray(apiPlans) && apiPlans.length > 0) {
          const parsed: CarrierPlan[] = apiPlans.map((p) => ({
            price: `$${p.price || p.amount || "0"}`,
            highlight: (p.title || p.highlight || p.description || "Prepaid Refill") as string,
            plan_id: String(p.plan_id || p.id || ""),
          }));
          setPlans(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(`CellPay fetch failed for ${slug}, using static plans:`, err);
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

  return { data, plans, loading, error, carrierId: data?.carrier?.id };
};
