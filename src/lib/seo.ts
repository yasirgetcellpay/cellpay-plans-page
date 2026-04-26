// Dynamic <head> manager for SEO tags driven by API data.
// Sets <title>, meta description, meta keywords, and JSON-LD schema.
// All tags are tagged with data-dynamic-seo so we can clean them up on unmount.

const DYNAMIC_ATTR = "data-dynamic-seo";

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

function upsertJsonLd(schema: string) {
  // Remove any previously injected JSON-LD tagged as dynamic
  document.head
    .querySelectorAll(`script[type="application/ld+json"][${DYNAMIC_ATTR}]`)
    .forEach((n) => n.remove());

  if (!schema) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute(DYNAMIC_ATTR, "true");
  // schema may be a string already (raw JSON) or an object
  script.text = typeof schema === "string" ? schema : JSON.stringify(schema);
  document.head.appendChild(script);
}

export interface SeoHeadData {
  title?: string;
  description?: string;
  keywords?: string;
  schema?: string;
}

export function applySeoHead(data: SeoHeadData) {
  if (data.title) document.title = data.title;
  if (data.description !== undefined) upsertMeta("description", data.description || "");
  if (data.keywords !== undefined) upsertMeta("keywords", data.keywords || "");
  if (data.schema !== undefined) upsertJsonLd(data.schema || "");
}
