"use client";

import { openConsentPreferences } from "@/components/analytics/consent-manager";
import { toggleAnalyticsDebugger } from "@/components/analytics/analytics-debugger";

/**
 * Footer entry points: reopen the consent preferences ("Cookie Settings") and
 * toggle the training Analytics Debugger. Client component so the server
 * footer stays a server component.
 */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={openConsentPreferences}
      className="text-left transition-colors hover:text-foreground"
    >
      Cookie Settings
    </button>
  );
}

export function AnalyticsDebuggerLink() {
  return (
    <button
      type="button"
      onClick={toggleAnalyticsDebugger}
      className="text-left transition-colors hover:text-foreground"
    >
      Analytics Debugger
    </button>
  );
}
