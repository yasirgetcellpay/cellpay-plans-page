import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { applySeoHead } from "@/lib/seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // Tell crawlers not to index soft-404 pages
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = robots?.getAttribute("content") ?? null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,follow");
    applySeoHead({ title: "Page Not Found | CellPay" });
    return () => {
      if (original !== null) robots!.setAttribute("content", original);
      else robots!.setAttribute("content", "index,follow,max-image-preview:large,max-snippet:-1");
    };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
