// Dynamic <head> manager for SEO tags driven by API data.
// Sets <title>, meta description, meta keywords, canonical, og:* and JSON-LD schema.
// All tags are tagged with data-dynamic-seo so we can clean them up on unmount.

const DYNAMIC_ATTR = "data-dynamic-seo";
const SITE_ORIGIN = "https://refill.cellpay.us";

function upsertMeta(name: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    el.setAttribute(DYNAMIC_ATTR, "true");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertProperty(property: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    el.setAttribute(DYNAMIC_ATTR, "true");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    el.setAttribute(DYNAMIC_ATTR, "true");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(schema: string, key = "default") {
  // Remove previously injected JSON-LD with this key
  document.head
    .querySelectorAll(`script[type="application/ld+json"][${DYNAMIC_ATTR}="${key}"]`)
    .forEach((n) => n.remove());

  if (!schema) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute(DYNAMIC_ATTR, key);
  script.text = typeof schema === "string" ? schema : JSON.stringify(schema);
  document.head.appendChild(script);
}

export interface SeoHeadData {
  title?: string;
  description?: string;
  keywords?: string;
  schema?: string;
  /** Path relative to site root, e.g. "/about-us". If omitted, uses location.pathname. */
  path?: string;
  /** Optional second JSON-LD blob (e.g. FAQPage alongside Product). */
  schemaSecondary?: string;
}

export function applySeoHead(data: SeoHeadData) {
  if (data.title) {
    document.title = data.title;
    upsertProperty("og:title", data.title);
    upsertMeta("twitter:title", data.title);
  }
  if (data.description !== undefined) {
    upsertMeta("description", data.description || "");
    upsertProperty("og:description", data.description || "");
    upsertMeta("twitter:description", data.description || "");
  }
  if (data.keywords !== undefined) upsertMeta("keywords", data.keywords || "");

  const path = data.path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const url = `${SITE_ORIGIN}${path}`;
  upsertCanonical(url);
  upsertProperty("og:url", url);

  if (data.schema !== undefined) upsertJsonLd(data.schema || "", "primary");
  if (data.schemaSecondary !== undefined) upsertJsonLd(data.schemaSecondary || "", "secondary");
}
