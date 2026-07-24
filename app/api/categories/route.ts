import { NextResponse } from "next/server";
import { getCategories } from "@/lib/db/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[api/categories] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}
