/**
 * Adapter (destination plugin) contract.
 *
 * The dispatcher hands every adapter the SAME canonical, PII-scrubbed
 * envelope. Anything vendor-specific — event renaming, parameter mapping,
 * script loading, network transport — lives inside the adapter. Adapters are
 * sandboxed: a throwing adapter is recorded as an error and never affects
 * commerce functionality or other adapters.
 */

import type { AnalyticsData } from "@/lib/analytics/schema";
import type { ConsentCategory, ConsentState } from "@/lib/analytics/consent";

export interface AnalyticsAdapter {
  /** Stable identifier shown in the debugger, e.g. "gtm". */
  readonly name: string;
  /** Human label for the debugger, e.g. "Google Tag Manager". */
  readonly label: string;
  /**
   * Consent category this destination requires. The dispatcher never calls
   * `track` unless the category is granted.
   */
  readonly consentCategory: ConsentCategory;
  /**
   * Whether the destination is actually wired up (script/ID/endpoint
   * configured). Unconfigured adapters are reported as "not_configured" —
   * the debugger must never pretend a vendor hit happened.
   */
  isConfigured(): boolean;
  /** One-time setup (script injection, SDK boot). Optional. */
  initialize?(): void;
  /** Deliver one canonical analyticsData envelope to the destination. */
  track(event: AnalyticsData): void;
  /**
   * Optional one-line description of how this adapter would translate the
   * given canonical event (e.g. `→ "add_to_cart" on window.dataLayer`).
   * Shown in the Analytics Debugger so learners can see the
   * canonical→vendor mapping without vendor knowledge leaking upstream.
   */
  describe?(event: AnalyticsData): string | undefined;
  /**
   * Called with the full consent state whenever it changes (and once with the
   * persisted state at startup), REGARDLESS of the adapter's own consent
   * category. This is the seam for vendor consent signalling — e.g. the GTM
   * adapter translating the neutral state into Google Consent Mode — which by
   * design must also be able to say "denied". Event delivery via `track` stays
   * separately gated by the dispatcher.
   */
  onConsentChange?(state: ConsentState): void;
  /** Teardown when the adapter is unregistered. Optional. */
  destroy?(): void;
}
