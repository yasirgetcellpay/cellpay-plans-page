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
  requestAnimationFrame(() => setTimeout(start, 0));
  setTimeout(start, 200);
} else {
  mount();
}
