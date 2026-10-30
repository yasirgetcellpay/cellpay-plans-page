// CCPA-BANNER-1029: display-only notice; never changes consent or payment behavior.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "cellpay_ccpa_dismissed_v1";
const GEO_KEY = "cellpay_geo_v1";
let traceCountry: Promise<string | null> | undefined;

export function ccpaAllowed(path: string, preview: boolean, dismissed: boolean, gpc: boolean): boolean {
  return !/^\/(?:es\/)?checkout\/?$/.test(path) && !dismissed && (!gpc || preview);
}

export function ccpaCalifornia(timeZone: string, country: string | null): boolean {
  return timeZone === "America/Los_Angeles" && country === "US";
}

function getTraceCountry(): Promise<string | null> {
  if (!traceCountry) {
    traceCountry = (async () => {
      let timer: number | undefined;
      try {
        const cached = sessionStorage.getItem(GEO_KEY);
        if (cached !== null) return /^[A-Z]{2}$/.test(cached) ? cached : null;
        const controller = new AbortController();
        timer = window.setTimeout(() => controller.abort(), 3000);
        const response = await fetch("/cdn-cgi/trace", { signal: controller.signal });
        if (!response.ok) return null;
        const country = (await response.text()).match(/^loc=([A-Z]{2})\r?$/m)?.[1] ?? null;
        if (country) sessionStorage.setItem(GEO_KEY, country);
        return country;
      } catch {
        return null;
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
      }
    })();
  }
  return traceCountry;
}

export default function CcpaBar() {
  const { pathname, search } = useLocation();
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const checkout = /^\/(?:es\/)?checkout\/?$/.test(pathname);
  const visible = eligible && !dismissed && !checkout;
  const es = pathname.startsWith("/es");

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timer: number | undefined;
    setEligible(false);
    async function checkRegion() {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone !== "America/Los_Angeles") return;
        const country = await getTraceCountry();
        if (!cancelled) setEligible(ccpaCalifornia(timeZone, country));
      } catch { /* Location failures leave the notice hidden. */ }
    }
    function schedule() {
      try {
        if (window.requestIdleCallback) idleId = window.requestIdleCallback(() => { void checkRegion(); }, { timeout: 3000 });
        else timer = window.setTimeout(() => { void checkRegion(); }, 0);
      } catch { /* Do not interfere with page load. */ }
    }
    try {
      const preview = new URLSearchParams(search).get("ccpa_preview") === "1";
      const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      if (!ccpaAllowed(pathname, preview, localStorage.getItem(DISMISSED_KEY) === "1", gpc)) return;
      if (preview) setEligible(true);
      else if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule, { once: true });
    } catch { /* Storage/region errors must never block the page. */ }
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [pathname, search]);

  useEffect(() => {
    if (!visible) return;
    const bar = barRef.current;
    if (!bar) return;
    const previousPadding = document.body.style.paddingBottom;
    let observer: ResizeObserver | undefined;
    const measure = () => {
      try { document.body.style.paddingBottom = `${bar.getBoundingClientRect().height}px`; }
      catch { /* Layout failures do not affect the page. */ }
    };
    try {
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(bar);
    } catch { /* Initial measurement remains usable without ResizeObserver. */ }
    return () => {
      try { observer?.disconnect(); document.body.style.paddingBottom = previousPadding; }
      catch { /* Best-effort layout cleanup. */ }
    };
  }, [visible, es]);

  if (!visible) return null;
  return (
    <div ref={barRef} role="region" aria-label="Privacy notice" className="fixed bottom-0 left-0 right-0 z-30 flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 bg-[hsl(var(--cellpay-dark))] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] text-[12px] leading-normal text-primary-foreground">
      <p className="min-w-0 flex-1 basis-[240px]">
        {es ? "Usamos cookies para anuncios y el uso del sitio. California: " : "We use cookies for ads and site use. California: "}
        <a className="text-primary-foreground underline" href={es ? "/es/privacy-policy#no-vender" : "/privacy-policy#do-not-sell"}>
          {es ? "No vender ni compartir mi información personal" : "Do Not Sell or Share My Personal Information"}
        </a>{" · "}
        <a className="text-primary-foreground underline" href={es ? "/es/privacy-policy" : "/privacy-policy"}>{es ? "Privacidad" : "Privacy"}</a>
      </p>
      <Button type="button" variant="outline" size="sm" className="ml-auto h-7 shrink-0 border-primary-foreground/60 bg-transparent px-2 text-[12px] text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => {
        try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* Hide for this visit even if storage is unavailable. */ }
        setDismissed(true);
      }}>{es ? "Entendido" : "Got it"}</Button>
    </div>
  );
}