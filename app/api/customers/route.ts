import { NextResponse } from "next/server";
import { currentAdminSession } from "@/lib/auth/guards";
import { getCustomersForAdmin } from "@/lib/db/admin-data";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

// The full customer list — admin only. The session is validated against D1 on
// every request; a buyer session is not an admin session.
export async function GET() {
  if (!(await currentAdminSession())) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401, headers: NO_STORE });
  }
  try {
    const customers = await getCustomersForAdmin();
    return NextResponse.json({ customers }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/customers] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500, headers: NO_STORE });
  }
}
