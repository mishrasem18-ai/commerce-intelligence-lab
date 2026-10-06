import { NextResponse } from "next/server";
import { currentBuyerSession } from "@/lib/auth/guards";
import { getOrdersByUserId } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

// The signed-in buyer's own orders. The user id comes from the D1-validated
// session cookie and nothing in the request can change it, so one buyer can
// never ask for another buyer's orders.
export async function GET() {
  const session = await currentBuyerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401, headers: NO_STORE });
  }
  try {
    const orders = await getOrdersByUserId(session.userId);
    return NextResponse.json({ orders }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/account/orders] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500, headers: NO_STORE });
  }
}
