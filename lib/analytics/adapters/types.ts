/**
 * Adapter (destination plugin) contract.
 *
 * The dispatcher hands every adapter the SAME canonical, PII-scrubbed
 * envelope. Anything vendor-specific — event renaming, parameter mapping,
 * script loading, network transport — lives inside the adapter. Adapters are
 * sandboxed: a throwing adapter is recorded as an error and never affects
 * commerce functionality or other adapters.
 */

import type { AnalyticsEvent } from "@/lib/analytics/schema";
import type { ConsentCategory } from "@/lib/analytics/consent";

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
  /** Deliver one canonical event to the destination. */
  track(event: AnalyticsEvent): void;
  /** Teardown when the adapter is unregistered. Optional. */
  destroy?(): void;
}
