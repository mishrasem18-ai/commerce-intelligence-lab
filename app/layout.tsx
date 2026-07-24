import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { getProducts } from "@/lib/db/products";
import { getOrders } from "@/lib/db/orders";
import { getCustomers } from "@/lib/db/customers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Commerce Intelligence Lab",
    template: "%s · Commerce Intelligence Lab",
  },
  description:
    "Enterprise commerce analytics — revenue, orders, customers and AI insights in one workspace.",
};

// The layout reads commerce data from D1 at request time, so rendering must be
// dynamic — the D1 binding only exists in the Worker runtime, not at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Authoritative commerce data is read from D1 on the server and handed to the
  // client stores. If D1 is unavailable this throws (surfaced by the error
  // boundary) rather than silently falling back to demo data.
  const [initialProducts, initialOrders, initialCustomers] = await Promise.all([
    getProducts(),
    getOrders(),
    getCustomers(),
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
            initialOrders={initialOrders}
            initialCustomers={initialCustomers}
          >
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
