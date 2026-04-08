import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
 * Fetches carrier data from the CellPay API via edge function.
 * Returns { data, plans, loading, error }.
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
        const { data: result, error: fnError } = await supabase.functions.invoke(
          `cellpay-proxy?action=view-carrier&slug=${encodeURIComponent(slug)}`
        );

        if (cancelled) return;

        if (fnError) {
          console.warn(`CellPay API error for ${slug}, using static plans:`, fnError);
          setError(fnError.message);
          setLoading(false);
          return;
        }

        const carrierData = result?.data || result;
        setData(carrierData);

        // Parse plans from the API response
        const apiPlans = carrierData?.carrier_plans;
        if (Array.isArray(apiPlans) && apiPlans.length > 0) {
          const parsed: CarrierPlan[] = apiPlans.map((p: Record<string, unknown>) => ({
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
    return () => { cancelled = true; };
  }, [slug]);

  return { data, plans, loading, error, carrierId: data?.carrier?.id };
};
