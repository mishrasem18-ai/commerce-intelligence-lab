"use client";

import Link from "next/link";
import { ArrowRight, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BuyerProductCard } from "@/components/store/buyer-product-card";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import { useProducts } from "@/lib/store/products-store";
import { buyerProducts } from "@/lib/commerce";
import { PRODUCT_CATEGORIES } from "@/lib/data/products";
import { cn } from "@/lib/utils";

export function HomeView() {
  const { products } = useProducts();
  const available = buyerProducts(products);

  const featured = [...available].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const popular = [...available]
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-14 pb-8">
      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 sm:p-12 lg:p-16">
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              New season, new gear
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Tech, style &amp; essentials — all in one place.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Shop premium electronics, fashion, home and more with fast delivery
              and a hassle-free returns policy.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className={buttonVariants({ size: "lg" })}>
                Shop Now
                <ArrowRight />
              </Link>
              <Link
                href="/shop?category=Electronics"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Browse Electronics
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Free shipping", desc: "On orders over $150" },
            { icon: RotateCcw, title: "Easy returns", desc: "30-day return policy" },
            { icon: ShieldCheck, title: "Secure checkout", desc: "Demo-safe payments" },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-xl font-semibold tracking-tight text-foreground">
          Shop by category
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PRODUCT_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category];
            return (
              <Link
                key={category}
                href={`/shop?category=${encodeURIComponent(category)}`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-foreground">{category}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <ProductSection title="Featured products" href="/shop" products={featured} />
      <ProductSection
        title="Most popular"
        href="/shop?sort=popularity"
        products={popular}
      />
    </div>
  );
}

function ProductSection({
  title,
  href,
  products,
}: {
  title: string;
  href: string;
  products: React.ComponentProps<typeof BuyerProductCard>["product"][];
}) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <Link
          href={href}
          className={cn("inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline")}
        >
          View all
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <BuyerProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
