import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fetchSeo } from "@/services/apiWrapper";
import { applySeoHead } from "@/lib/seo";

/**
 * Fetches SEO metadata for the current route on every navigation and
 * dynamically updates the document <head> (title, meta description,
 * meta keywords, JSON-LD schema).
 *
 * Mounted once at the App root via <RouteSeo />.
 */
export function useRouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seo = await fetchSeo(pathname);
      if (cancelled) return;
      applySeoHead({
        title: seo.title_for_layout,
        description: seo.seo_description,
        keywords: seo.seo_keywords,
        schema: seo.seo_schema,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
}

export const RouteSeo = () => {
  useRouteSeo();
  return null;
};
