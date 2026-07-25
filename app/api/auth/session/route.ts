import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBuyerSession, BUYER_COOKIE } from "@/lib/auth/session";
import { getCustomerById } from "@/lib/db/customers";

// Returns the current buyer identity (validated against D1) or null, together
// with the buyer's full customer profile so the client store can hydrate the
// signed-in buyer without depending on a stale server-rendered snapshot.
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  const session = token ? await getBuyerSession(token) : null;
  if (!session) return NextResponse.json({ buyer: null, customer: null });

  const customer = await getCustomerById(session.userId);
  return NextResponse.json({
    buyer: { customerId: session.userId, email: session.email, name: session.name },
    customer,
  });
}
