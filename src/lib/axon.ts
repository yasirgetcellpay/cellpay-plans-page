// AppLovin Axon Pixel helper. The base pixel is loaded in index.html and
// exposes `window.AlPixelObject.track(event, params?)`. We wrap it here so
// callers can fire ecommerce events without worrying about the pixel being
// uninitialized or breaking the page if it failed to load.

type AxonParams = Record<string, unknown>;

interface AxonPixel {
  track: (event: string, params?: AxonParams) => void;
}

declare global {
  interface Window {
    AlPixelObject?: AxonPixel;
  }
}

export function trackAxon(event: string, params?: AxonParams): void {
  try {
    window.AlPixelObject?.track(event, params);
  } catch {
    /* swallow — analytics must never break the app */
  }
}
