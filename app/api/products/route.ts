import { NextResponse } from "next/server";
import { getProducts } from "@/lib/db/products";

// D1-backed products read. Server-only route handler — the browser calls this
// endpoint; it never touches the D1 binding directly.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[api/products] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
