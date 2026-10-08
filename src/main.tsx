import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root")!;
const mount = () =>
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );

// SPEED-1006b: the /go ad landers ship a static copy of their first screen (vite.config.ts, data-go-prerender).
// Let the browser paint it first, then React replaces it with the same markup (nothing moves).
// Every other page mounts right away, as before.
if (rootEl.hasAttribute("data-go-prerender")) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    mount();
  };
  // SPEED-WWW-1008: start React only after the static first screen has actually painted (first-contentful-paint),
  // then two more frames. The old 200 ms backup timer could mount React before the first frame was painted, which left
  // the screen blank until the whole app had loaded. Browsers without paint timing start after two frames.
  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 0)));
  let watching = false;
  try {
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("paint")) {
      const po = new PerformanceObserver((list) => {
        if (list.getEntriesByName("first-contentful-paint").length) {
          po.disconnect();
          afterPaint();
        }
      });
      po.observe({ type: "paint", buffered: true });
      watching = true;
    }
  } catch {
    watching = false;
  }
  if (!watching) afterPaint();
  // Background tabs never paint: mount right away there. Otherwise a 3 s safety net.
  setTimeout(start, document.visibilityState === "hidden" ? 0 : 3000);
} else {
  mount();
}
