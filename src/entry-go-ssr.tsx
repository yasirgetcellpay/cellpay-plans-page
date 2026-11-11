import { renderToString } from "react-dom/server"; // GO-PRERENDER-1110
import { StaticRouter } from "react-router-dom/server"; // GO-PRERENDER-1110
import { AuthProvider } from "./contexts/AuthContext"; // GO-PRERENDER-1110
import { AppErrorBoundary } from "./components/AppErrorBoundary"; // GO-PRERENDER-1110
import { AppRoutes } from "./App"; // GO-PRERENDER-1110
const storage = (): Storage => { // GO-PRERENDER-1110
  const values = new Map<string, string>(); // GO-PRERENDER-1110
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, String(value)); } }; // GO-PRERENDER-1110
}; // GO-PRERENDER-1110
export function renderGo(url: string): string { // GO-PRERENDER-1110
  if (typeof window !== "undefined") throw new Error("Build-time rendering only"); // GO-PRERENDER-1110
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage(); // GO-PRERENDER-1110
  return renderToString(<AuthProvider><StaticRouter location={url}><AppErrorBoundary><AppRoutes /></AppErrorBoundary></StaticRouter></AuthProvider>); // GO-PRERENDER-1110
} // GO-PRERENDER-1110