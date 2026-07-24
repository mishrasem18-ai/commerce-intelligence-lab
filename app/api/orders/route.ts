import { NextResponse } from "next/server";
import { getOrders } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[api/orders] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
