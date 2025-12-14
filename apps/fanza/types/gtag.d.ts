// Global gtag type declaration
type GtagCommand = 'config' | 'event' | 'js' | 'set' | 'get' | 'consent';

declare global {
  interface Window {
    gtag: (
      command: GtagCommand | string,
      targetOrEventName: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

export {};
