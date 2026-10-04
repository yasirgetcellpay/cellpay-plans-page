import { Component, type ErrorInfo, type ReactNode } from "react";

// CK-0: a render error anywhere (e.g. Checkout) shows a recover / go-home screen instead of a blank white page.
// Plain links and reload only (it sits outside the router). No payment, storage or tracking calls.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const es = /^\/es(\/|$)/.test(window.location.pathname);
    const home = (es ? "/es" : "/") + window.location.search;
    return (
      <main role="alert" className="min-h-screen flex items-center justify-center bg-background px-6 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-extrabold text-foreground">{es ? "Algo salió mal" : "Something went wrong"}</h1>
          <p className="text-sm text-muted-foreground">
            {es
              ? "Esta página no se pudo cargar. Inténtelo de nuevo. Si estaba pagando, no pague de nuevo antes de escribir a support@getcellpay.com."
              : "This page couldn't load. Please try again. If you were in the middle of a payment, don't pay again before emailing support@getcellpay.com."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              {es ? "Intentar de nuevo" : "Try again"}
            </button>
            <a href={home} className="min-h-[44px] px-5 rounded-lg border border-border font-semibold inline-flex items-center justify-center text-foreground">
              {es ? "Ir al inicio" : "Go to home page"}
            </a>
          </div>
        </div>
      </main>
    );
  }
}
