import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBuyerSession, BUYER_COOKIE } from "@/lib/auth/session";
import { getProductById } from "@/lib/db/products";
import { createOrder, getOrders } from "@/lib/db/orders";
import { computeOrderTotals } from "@/lib/commerce";
import type { Order, PaymentMethod, PaymentStatus } from "@/lib/data";

// D1-backed orders read (admin list).
export async function GET() {
  try {
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[api/orders GET] D1 read failed:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

// Server-authoritative checkout. The buyer session is validated against D1 and
// the user must exist — a fabricated localStorage buyer cannot place an order.
// Prices/totals/stock are recomputed from D1; client-supplied money is ignored.
export const dynamic = "force-dynamic";

interface ReqItem { productId: string; quantity: number }
interface ReqAddress {
  fullName?: string; mobile?: string; line1?: string; line2?: string;
  city?: string; state?: string; postalCode?: string; country?: string; countryCode?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Server-side buyer identity (D1 session + user must exist).
    const token = (await cookies()).get(BUYER_COOKIE)?.value;
    const session = token ? await getBuyerSession(token) : null;
    if (!session) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      items?: ReqItem[];
      shippingAddress?: ReqAddress;
      contactEmail?: string;
      contactMobile?: string;
      paymentMethod?: string;
    } | null;

    const items = Array.isArray(body?.items) ? body!.items : [];
    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "Cart is empty." }, { status: 400 });
    }
    const ship = body?.shippingAddress ?? {};
    if (!ship.line1 || !ship.city) {
      return NextResponse.json({ ok: false, error: "Shipping address is incomplete." }, { status: 400 });
    }
    const paymentMethod: PaymentMethod = body?.paymentMethod === "Card" ? "Card" : "COD";
    const paymentStatus: PaymentStatus = paymentMethod === "Card" ? "Paid" : "Pending";

    // 2. Recompute prices/stock from D1 (never trust client money).
    const resolved: {
      productId: string; name: string; sku: string; unitPriceCents: number; quantity: number;
    }[] = [];
    let subtotalDollars = 0;
    for (const it of items) {
      const qty = Math.floor(Number(it.quantity));
      if (!it.productId || !Number.isFinite(qty) || qty < 1) {
        return NextResponse.json({ ok: false, error: "Invalid item." }, { status: 400 });
      }
      const product = await getProductById(it.productId);
      if (!product) {
        return NextResponse.json({ ok: false, error: "Product not found." }, { status: 400 });
      }
      if (qty > product.inventory) {
        return NextResponse.json(
          { ok: false, error: `Not enough stock for ${product.name}.` },
          { status: 409 },
        );
      }
      const unitPriceCents = Math.round(product.price * 100);
      subtotalDollars += product.price * qty;
      resolved.push({
        productId: product.id, name: product.name, sku: product.sku, unitPriceCents, quantity: qty,
      });
    }

    const totals = computeOrderTotals(subtotalDollars);
    const toCents = (n: number) => Math.round(n * 100);

    // 3. Atomic order creation (insert order+items, decrement inventory, user metrics).
    const { id, orderNumber, placedAt } = await createOrder({
      userId: session.userId,
      customerName: session.name,
      email: (body?.contactEmail || session.email).trim(),
      country: ship.country ?? "",
      countryCode: ship.countryCode ?? "",
      subtotalCents: toCents(totals.subtotal),
      taxCents: toCents(totals.tax),
      shippingCents: toCents(totals.shipping),
      totalCents: toCents(totals.total),
      paymentMethod,
      paymentStatus,
      shipping: {
        fullName: ship.fullName ?? session.name,
        mobile: ship.mobile ?? body?.contactMobile ?? "",
        line1: ship.line1,
        line2: ship.line2 ?? null,
        city: ship.city,
        state: ship.state ?? "",
        postalCode: ship.postalCode ?? "",
        country: ship.country ?? "",
      },
      items: resolved,
    });

    // Return the created order (domain shape) for immediate client display.
    const order: Order = {
      id,
      orderNumber,
      customerId: session.userId,
      customer: session.name,
      email: (body?.contactEmail || session.email).trim(),
      country: ship.country ?? "",
      countryCode: ship.countryCode ?? "",
      amount: totals.total,
      status: "Processing",
      date: placedAt.slice(0, 10),
      items: resolved.reduce((s, r) => s + r.quantity, 0),
      lineItems: resolved.map((r) => ({
        productId: r.productId, name: r.name, sku: r.sku, price: r.unitPriceCents / 100, quantity: r.quantity,
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      total: totals.total,
      shippingAddress: {
        id: `addr-${id}`,
        fullName: ship.fullName ?? session.name,
        mobile: ship.mobile ?? "",
        line1: ship.line1,
        line2: ship.line2,
        city: ship.city,
        state: ship.state ?? "",
        postalCode: ship.postalCode ?? "",
        country: ship.country ?? "",
      },
      paymentMethod,
      paymentStatus,
      createdAt: placedAt,
    };
    return NextResponse.json({ ok: true, order, orderNumber });
  } catch (error) {
    console.error("[api/orders POST] failed:", error);
    return NextResponse.json({ ok: false, error: "Could not place order." }, { status: 500 });
  }
}
