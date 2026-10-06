import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { getProducts } from "@/lib/db/products";
import { currentBuyerSession } from "@/lib/auth/guards";
import { RootAnalytics } from "@/components/analytics/root-analytics";
import { STORE_SITE_NAME } from "@/lib/routes/page-titles";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every page sets an absolute title from lib/routes/page-titles.ts.
  title: { default: STORE_SITE_NAME, template: `%s · ${STORE_SITE_NAME}` },
  description:
    "Enterprise commerce analytics — revenue, orders, customers and AI insights in one workspace.",
};

// The layout reads the catalog from D1 at request time, so rendering must be
// dynamic — the D1 binding only exists in the Worker runtime, not at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout renders for EVERY visitor, so the D1 data it passes to the
  // client stores is public: the catalog. Customer and order records are
  // loaded behind a session check instead — the full lists in the admin
  // layout, a buyer's own through the buyer account store. If D1 is
  // unavailable this throws (surfaced by the error boundary) rather than
  // silently falling back to demo data.
  //
  // The one per-visitor value is the signed-in buyer's own opaque customer id
  // (never the email or name), so analytics can attach it to the document's
  // first events instead of waiting for the browser's session check. The
  // session cookie is validated against D1; a missing, expired or forged one
  // gives null, and a failed lookup leaves the id to that later check. Every
  // response of this layout is `private, no-store`.
  const [initialProducts, buyerSession] = await Promise.all([
    getProducts(),
    currentBuyerSession().catch(() => null),
  ]);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Providers
            initialProducts={initialProducts}
            buyerCustomerId={buyerSession?.userId ?? null}
          >
            {children}
            {/* After the page, so React runs the page's layout effects (its title
                registration) before the tracker's in the same commit. */}
            <RootAnalytics />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
