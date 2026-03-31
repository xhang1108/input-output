/**
 * Analytics Utility
 * Unified interface for tracking custom events in Google Analytics.
 * Uses the 'gtag' function provided by @next/third-parties.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type AnalyticsEvent =
  | { name: 'add_node'; params: { type: string } }
  | { name: 'share_graph'; params: { platform: string } }
  | { name: 'run_calculation'; params: { node_count: number } }
  | { name: 'wiki_navigation'; params: { section: string, mode: string } };

/**
 * Send a custom event to Google Analytics
 */
export function trackEvent(event: AnalyticsEvent) {
  if (typeof window !== 'undefined' \u0026\u0026 window.gtag) {
    window.gtag('event', event.name, event.params);
  }
}

/**
 * Shorthand for common events
 */
export const analytics = {
  addNode: (type: string) =\u003e trackEvent({ name: 'add_node', params: { type } }),
  shareGraph: (platform: string) =\u003e trackEvent({ name: 'share_graph', params: { platform } }),
  runCalculation: (node_count: number) =\u003e trackEvent({ name: 'run_calculation', params: { node_count } }),
};
