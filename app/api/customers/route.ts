import { NextResponse } from "next/server";
import { getCustomers } from "@/lib/db/customers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customers = await getCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    console.error("[api/customers] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}
