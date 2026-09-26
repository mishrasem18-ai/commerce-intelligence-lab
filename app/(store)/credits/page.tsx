import type { Metadata } from "next";
import { ProductImage } from "@/components/products/product-image";
import { CATEGORIES } from "@/lib/catalog/categories";
import {
  describeModifications,
  providerLabel,
  type ProductImageManifest,
} from "@/lib/catalog/image-manifest";
import { routeMetadata } from "@/lib/routes/page-titles";
import manifestJson from "@/data/product-images.json";

export const metadata: Metadata = routeMetadata("credits");

const manifest = manifestJson as ProductImageManifest;

/**
 * Attribution for every product photo: creator, source, license and what we
 * changed — straight from data/product-images.json, whose license fields were
 * re-checked at each image's origin page.
 */
export default function CreditsPage() {
  const byCategory = CATEGORIES.map((category) => ({
    category,
    entries: manifest.entries.filter((e) => e.category === category.name),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Image credits</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Aurora Market is a demo store with fictional brands. Its product photos are real
        photographs of each product type, published by their creators under open licenses on
        Wikimedia Commons and Flickr, and self-hosted here. Every photo was cropped to a square
        and resized; no photo shows a real brand. Book covers are original designs for fictional
        titles, composited onto a public-domain photo of a blank book.
      </p>

      {byCategory.map(({ category, entries }) => (
        <section key={category.id} className="mt-10" aria-labelledby={`credits-${category.id}`}>
          <h2
            id={`credits-${category.id}`}
            className="mb-3 text-lg font-semibold tracking-tight text-foreground"
          >
            {category.name}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {entries.map((entry) => (
              <li key={entry.slug} className="flex gap-4 p-4">
                <ProductImage
                  src={entry.slug}
                  alt={entry.alt_text || entry.noun}
                  category={entry.category}
                  usage="creditThumb"
                  className="size-16 shrink-0 rounded-lg"
                  iconSize={20}
                />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">{entry.noun}</p>
                  {entry.provider === "none" ? (
                    <p className="text-muted-foreground">
                      Illustrated placeholder — no open-license photo met our criteria.
                    </p>
                  ) : (
                    <>
                      {entry.composite && (
                        <p className="text-muted-foreground">
                          Cover design: Aurora Market (fictional title and author). Base photo:
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {entry.creator} ·{" "}
                        <a
                          href={entry.origin_page_url}
                          className="underline underline-offset-2 hover:text-foreground"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {providerLabel(entry.provider)}
                        </a>{" "}
                        ·{" "}
                        <a
                          href={entry.license_url}
                          className="underline underline-offset-2 hover:text-foreground"
                          target="_blank"
                          rel="license noopener noreferrer"
                        >
                          {entry.license} {entry.license_version}
                        </a>
                      </p>
                      <p className="text-xs text-muted-foreground">{describeModifications(entry)}</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
