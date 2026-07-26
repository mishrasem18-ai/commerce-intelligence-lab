"use client";

import * as React from "react";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { analytics } from "@/lib/analytics";
import { useConsentRecord } from "@/lib/analytics/use-consent";
import { useMounted } from "@/lib/use-mounted";
import type { ConsentCategory } from "@/lib/analytics/consent";

/**
 * Aurora Market's own educational consent UI (not a real CMP clone):
 * a first-visit banner (Accept All / Reject All / Manage Preferences) and a
 * preferences dialog reachable at any time via the footer "Cookie Settings"
 * link. No dark patterns: accepting and rejecting are equally prominent.
 */

const OPEN_PREFERENCES_EVENT = "aurora:consent:open-preferences";

/** Open the consent preferences dialog from anywhere (e.g. footer link). */
export function openConsentPreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
  }
}

/** banner_view fires once per page load, not on every consent re-render. */
let bannerViewTracked = false;

const CATEGORY_COPY: Array<{
  key: ConsentCategory;
  title: string;
  description: string;
}> = [
  {
    key: "necessary",
    title: "Necessary",
    description:
      "Required for core features like the cart, sign-in and security. Always on.",
  },
  {
    key: "analytics",
    title: "Analytics",
    description:
      "Lets us measure how the store is used (page views, product and checkout events).",
  },
  {
    key: "advertising",
    title: "Advertising",
    description:
      "Would allow ad-performance measurement. No ad vendors are configured in this lab.",
  },
  {
    key: "personalization",
    title: "Personalization",
    description:
      "Would allow personalized content and recommendations based on your activity.",
  },
];

export function ConsentManager() {
  const mounted = useMounted();
  const record = useConsentRecord();
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<ConsentCategory, boolean>>({
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const showBanner = mounted && !record.decidedAt && !prefsOpen;

  // Canonical consent.banner_view — internally observable even while all
  // analytics adapters are blocked (no circular consent behaviour).
  React.useEffect(() => {
    if (showBanner && !bannerViewTracked) {
      bannerViewTracked = true;
      analytics.track("consent.banner_view");
    }
  }, [showBanner]);

  const openPreferences = React.useCallback(() => {
    const state = analytics.consent.getState();
    setDraft({
      necessary: true,
      analytics: state.analytics,
      advertising: state.advertising,
      personalization: state.personalization,
    });
    setPrefsOpen(true);
  }, []);

  // Footer "Cookie Settings" (or anything else) can reopen preferences.
  React.useEffect(() => {
    const onOpen = () => openPreferences();
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
  }, [openPreferences]);

  // Dialog: Escape closes, background scroll locks, focus moves in.
  React.useEffect(() => {
    if (!prefsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPrefsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [prefsOpen]);

  const acceptAll = () => {
    analytics.updateConsent("accept_all");
    setPrefsOpen(false);
  };
  const rejectAll = () => {
    analytics.updateConsent("reject_all");
    setPrefsOpen(false);
  };
  const savePreferences = () => {
    analytics.updateConsent("custom", draft);
    setPrefsOpen(false);
  };

  return (
    <>
      {showBanner && (
        <section
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-card/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-6 lg:px-8">
            <div className="flex items-start gap-3 md:flex-1">
              <span className="mt-0.5 hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
                <Cookie className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Your privacy choices.
                </span>{" "}
                Aurora Market is an educational analytics lab. We use your
                choices to decide which measurement categories may run —
                nothing runs until you decide, and necessary functionality
                always works.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={openPreferences}>
                Manage Preferences
              </Button>
              <Button size="sm" variant="outline" onClick={rejectAll}>
                Reject All
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept All
              </Button>
            </div>
          </div>
        </section>
      )}

      {prefsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-preferences-title"
        >
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setPrefsOpen(false)}
            aria-hidden
          />
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl shadow-black/20 outline-none sm:animate-pop sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2
                id="consent-preferences-title"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Privacy Preferences
              </h2>
              <button
                type="button"
                aria-label="Close preferences"
                onClick={() => setPrefsOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Choose which measurement categories Aurora Market may use.
                Changes apply immediately and are stored on this device.
              </p>
              <ul className="flex flex-col gap-3">
                {CATEGORY_COPY.map(({ key, title, description }) => {
                  const id = `consent-${key}`;
                  const always = key === "necessary";
                  return (
                    <li
                      key={key}
                      className="flex items-start justify-between gap-4 rounded-xl border border-border p-3.5"
                    >
                      <div className="min-w-0">
                        <label
                          htmlFor={id}
                          className="text-sm font-medium text-foreground"
                        >
                          {title}
                          {always && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Always enabled
                            </span>
                          )}
                        </label>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </div>
                      <Switch
                        id={id}
                        aria-label={`${title} consent`}
                        checked={always ? true : draft[key]}
                        disabled={always}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({ ...prev, [key]: checked }))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={rejectAll}>
                  Reject All
                </Button>
                <Button size="sm" variant="outline" onClick={acceptAll}>
                  Accept All
                </Button>
              </div>
              <Button size="sm" onClick={savePreferences}>
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
