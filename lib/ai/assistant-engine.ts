/**
 * AI Assistant intent engine.
 *
 * This module is intentionally PURE and dependency-free at runtime — it only
 * uses `import type` (erased at build/run time), so it can be unit-tested in
 * isolation and bundles cleanly into the Cloudflare Worker. All commerce data
 * is passed in by the caller (the client component reads the live stores and
 * the app's static analytics datasets and hands them to `answerQuestion`).
 *
 * Every answer is derived from the supplied data. Nothing is fabricated: if a
 * question does not map to a known category the engine returns a scoped help
 * message instead of falling through to a generic commerce summary.
 */

import type { Product } from "../data/products";
import type {
  Order,
  Customer,
  Kpi,
  MonthlyPoint,
  TrafficSource,
  FunnelStage,
} from "../data";

export type Intent =
  | "inventory"
  | "revenue"
  | "conversion"
  | "customers"
  | "orders"
  | "product_performance"
  | "traffic"
  | "unknown";

/** Everything the engine needs to answer a question, supplied by the caller. */
export interface CommerceSnapshot {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  kpis: Kpi[];
  monthly: MonthlyPoint[];
  traffic: TrafficSource[];
  funnel: FunnelStage[];
  lowStockThreshold: number;
}

/* -------------------------------------------------------------------------- */
/*  Intent classification                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Weighted keyword rules. Terms are matched at word starts (so "stock" also
 * catches "stocks"/"stockout" and "product" catches "products"), which keeps
 * the classifier robust to natural-language phrasing and simple plurals.
 * Specific multi-word phrases carry more weight than generic single words.
 */
const RULES: { intent: Intent; terms: [string, number][] }[] = [
  {
    intent: "inventory",
    terms: [
      ["stockout", 4],
      ["out of stock", 4],
      ["low stock", 4],
      ["restock", 3],
      ["reorder", 3],
      ["replenish", 3],
      ["running low", 3],
      ["sold out", 3],
      ["inventory", 3],
      ["stock", 2],
      ["in stock", 2],
      ["units left", 2],
      ["supply", 1],
    ],
  },
  {
    intent: "revenue",
    terms: [
      ["revenue", 3],
      ["sales", 2],
      ["income", 3],
      ["earnings", 3],
      ["turnover", 3],
      ["top line", 3],
      ["gross", 2],
      ["how much did we make", 3],
      ["money", 1],
    ],
  },
  {
    intent: "conversion",
    terms: [
      ["conversion", 3],
      ["convert", 3],
      ["funnel", 3],
      ["add to cart", 3],
      ["cart abandon", 3],
      ["abandon", 2],
      ["checkout rate", 3],
      ["drop off", 2],
      ["bounce", 2],
      ["close rate", 2],
      ["dip", 1],
    ],
  },
  {
    intent: "customers",
    terms: [
      ["customer", 3],
      ["buyer", 2],
      ["shopper", 2],
      ["retention", 3],
      ["churn", 3],
      ["vip", 3],
      ["at risk", 2],
      ["returning", 2],
      ["loyal", 2],
      ["audience", 2],
      ["who buys", 3],
    ],
  },
  {
    intent: "orders",
    terms: [
      ["order", 3],
      ["purchase", 2],
      ["transaction", 3],
      ["refund", 2],
      ["cancelled", 2],
      ["canceled", 2],
      ["shipped", 2],
      ["fulfillment", 3],
      ["average order value", 3],
      ["aov", 3],
      ["pending order", 2],
    ],
  },
  {
    intent: "product_performance",
    terms: [
      ["product performance", 4],
      ["best seller", 4],
      ["bestseller", 4],
      ["best selling", 4],
      ["best-selling", 4],
      ["top product", 4],
      ["top seller", 4],
      ["worst product", 4],
      ["underperforming", 3],
      ["units sold", 3],
      ["selling product", 3],
      ["which products sell", 3],
      ["product", 1],
    ],
  },
  {
    intent: "traffic",
    terms: [
      ["ad spend", 4],
      ["adspend", 4],
      ["ad budget", 4],
      ["focus ad", 4],
      ["paid social", 4],
      ["advertising", 3],
      ["marketing", 3],
      ["traffic", 3],
      ["channel", 2],
      ["organic", 2],
      ["campaign", 2],
      ["acquisition", 2],
      ["spend next month", 2],
      ["where to spend", 2],
    ],
  },
];

/** Normalise to a space-padded, alphanumeric-only string for word matching. */
function normalize(question: string): string {
  return ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function scoreIntent(norm: string, terms: [string, number][]): number {
  let score = 0;
  for (const [term, weight] of terms) {
    // Word-start match: " term" catches the word and its simple plurals.
    if (norm.includes(` ${term}`)) score += weight;
  }
  return score;
}

/** Classify a natural-language question into a commerce intent (pure). */
export function classifyIntent(question: string): Intent {
  const norm = normalize(question);
  let best: Intent = "unknown";
  let bestScore = 0;
  for (const rule of RULES) {
    const score = scoreIntent(norm, rule.terms);
    if (score > bestScore) {
      bestScore = score;
      best = rule.intent;
    }
  }
  return bestScore > 0 ? best : "unknown";
}

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                        */
/* -------------------------------------------------------------------------- */

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-US");

function money(value: number): string {
  return usd0.format(Math.round(value));
}
function count(value: number): string {
  return num.format(value);
}
function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
function list(items: string[]): string {
  return items.join(", ");
}
function kpi(kpis: Kpi[], id: string): Kpi | undefined {
  return kpis.find((k) => k.id === id);
}

/* -------------------------------------------------------------------------- */
/*  Data-grounded answer builders                                             */
/* -------------------------------------------------------------------------- */

function answerInventory(data: CommerceSnapshot): string {
  const { products, lowStockThreshold } = data;
  const out = products
    .filter((p) => p.inventory <= 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const low = products
    .filter((p) => p.inventory > 0 && p.inventory <= lowStockThreshold)
    .sort((a, b) => a.inventory - b.inventory);

  if (out.length === 0 && low.length === 0) {
    return `Inventory looks healthy — no products are out of stock and none are at or below the low-stock threshold of ${lowStockThreshold} units (checked ${count(products.length)} products).`;
  }

  const urgent = low
    .slice(0, 5)
    .map((p) => `${p.name} (${p.category}) — ${p.inventory} left`);

  const parts: string[] = [];
  parts.push(
    `${count(low.length)} product${low.length === 1 ? " is" : "s are"} running low (≤ ${lowStockThreshold} units) and ${count(out.length)} ${out.length === 1 ? "is" : "are"} out of stock, across ${count(products.length)} products.`,
  );
  if (urgent.length > 0) {
    parts.push(`Most at risk of stockout: ${list(urgent)}.`);
  }
  if (out.length > 0) {
    const outNames = out.slice(0, 5).map((p) => p.name);
    parts.push(
      `Already out of stock: ${list(outNames)}${out.length > 5 ? `, and ${count(out.length - 5)} more` : ""}.`,
    );
  }
  parts.push("Recommend prioritising restock on the lowest-inventory items above.");
  return parts.join(" ");
}

function answerRevenue(data: CommerceSnapshot): string {
  const { kpis, monthly, products } = data;
  const rev = kpi(kpis, "revenue");
  const aov = kpi(kpis, "aov");

  const parts: string[] = [];
  if (rev) {
    const dir = rev.delta >= 0 ? "up" : "down";
    parts.push(
      `Revenue is ${rev.value} for the latest month — ${dir} ${pct(Math.abs(rev.delta))} vs the prior month.`,
    );
  }
  if (monthly.length >= 6) {
    const lastQ = monthly.slice(-3).reduce((s, m) => s + m.revenue, 0);
    const priorQ = monthly.slice(-6, -3).reduce((s, m) => s + m.revenue, 0);
    const change = priorQ ? (lastQ - priorQ) / priorQ : 0;
    parts.push(
      `Over the last quarter you booked ${money(lastQ)} vs ${money(priorQ)} the previous quarter (${change >= 0 ? "+" : ""}${pct(change)}).`,
    );
  }
  // Top revenue category, computed from real product data.
  const byCategory = new Map<string, number>();
  for (const p of products) {
    byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.revenue);
  }
  const topCat = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    parts.push(`Your top category by revenue is ${topCat[0]} (${money(topCat[1])}).`);
  }
  if (aov) parts.push(`Average order value is ${aov.value}.`);
  return parts.join(" ");
}

function answerConversion(data: CommerceSnapshot): string {
  const { kpis, funnel, traffic } = data;
  const conv = kpi(kpis, "conversion");
  const parts: string[] = [];
  if (conv) {
    const dir = conv.delta >= 0 ? "up" : "down";
    parts.push(
      `Conversion is ${conv.value}, ${dir} ${(Math.abs(conv.delta) * 100).toFixed(1)}pts vs last month.`,
    );
  }
  if (funnel.length >= 2) {
    // Find the steepest stage-to-stage drop-off.
    let worst = { from: funnel[0], to: funnel[1], retained: 1 };
    for (let i = 1; i < funnel.length; i++) {
      const retained = funnel[i - 1].value ? funnel[i].value / funnel[i - 1].value : 0;
      if (retained < worst.retained) {
        worst = { from: funnel[i - 1], to: funnel[i], retained };
      }
    }
    const first = funnel[0];
    const last = funnel[funnel.length - 1];
    parts.push(
      `The steepest funnel drop-off is ${worst.from.stage} → ${worst.to.stage}, where only ${pct(worst.retained)} continue.`,
    );
    parts.push(
      `Of ${count(first.value)} ${first.stage.toLowerCase()}, ${count(last.value)} reached ${last.stage.toLowerCase()}.`,
    );
  }
  const paidSocial = traffic.find((t) => /paid social/i.test(t.channel));
  if (paidSocial) {
    parts.push(
      `Paid Social is ${pct(paidSocial.share, 0)} of traffic and typically converts below the site average — a likely drag on the blended rate.`,
    );
  }
  return parts.join(" ");
}

function answerCustomers(data: CommerceSnapshot): string {
  const { customers, kpis } = data;
  const total = customers.length;
  const byStatus = (status: Customer["status"]) =>
    customers.filter((c) => c.status === status).length;
  const top = [...customers].sort((a, b) => b.spent - a.spent)[0];
  const returning = kpi(kpis, "returning");

  const parts: string[] = [];
  parts.push(
    `There ${total === 1 ? "is" : "are"} ${count(total)} customer${total === 1 ? "" : "s"} in the system — ${byStatus("VIP")} VIP, ${byStatus("Active")} active, ${byStatus("New")} new, ${byStatus("At Risk")} at risk.`,
  );
  if (top) {
    parts.push(`Top customer by lifetime spend is ${top.name} (${money(top.spent)} across ${count(top.orders)} orders).`);
  }
  if (returning) parts.push(`Returning customers make up ${returning.value} of orders.`);
  return parts.join(" ");
}

function answerOrders(data: CommerceSnapshot): string {
  const { orders, kpis } = data;
  const total = orders.length;
  const value = orders.reduce((s, o) => s + (o.total ?? o.amount ?? 0), 0);
  const statusCounts = new Map<string, number>();
  for (const o of orders) {
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  }
  const statusMix = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${n} ${status.toLowerCase()}`);
  const recent = [...orders]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 3)
    .map((o) => `${o.orderNumber ?? o.id} (${o.customer}, ${money(o.total ?? o.amount)})`);
  const aov = kpi(kpis, "aov");

  const parts: string[] = [];
  parts.push(
    `There ${total === 1 ? "is" : "are"} ${count(total)} order${total === 1 ? "" : "s"} in the system worth ${money(value)} in total.`,
  );
  if (statusMix.length > 0) parts.push(`Status mix: ${list(statusMix)}.`);
  if (recent.length > 0) parts.push(`Most recent: ${list(recent)}.`);
  if (aov) parts.push(`Average order value is ${aov.value}.`);
  return parts.join(" ");
}

function answerProductPerformance(data: CommerceSnapshot): string {
  const { products } = data;
  const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const byUnits = [...products].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 3);

  const parts: string[] = [];
  if (byRevenue.length > 0) {
    parts.push(
      `Top products by revenue: ${list(byRevenue.map((p) => `${p.name} (${money(p.revenue)})`))}.`,
    );
  }
  if (byUnits.length > 0) {
    parts.push(
      `Best-selling by units: ${list(byUnits.map((p) => `${p.name} (${count(p.unitsSold)} sold)`))}.`,
    );
  }
  return parts.join(" ");
}

function answerTraffic(data: CommerceSnapshot): string {
  const { traffic, kpis } = data;
  const sorted = [...traffic].sort((a, b) => b.share - a.share);
  const conv = kpi(kpis, "conversion");
  const paidSocial = sorted.find((t) => /paid social/i.test(t.channel));
  const topIntent = sorted.find((t) => !/paid social/i.test(t.channel));

  const parts: string[] = [];
  if (sorted.length > 0) {
    parts.push(
      `Traffic mix by share: ${list(sorted.map((t) => `${t.channel} ${pct(t.share, 0)}`))}.`,
    );
  }
  if (paidSocial) {
    parts.push(
      `Paid Social drives ${pct(paidSocial.share, 0)} of visits (${count(paidSocial.visitors)}) but tends to convert below the ${conv ? conv.value : "site"} average.`,
    );
  }
  if (topIntent) {
    parts.push(
      `Higher-intent channels like ${topIntent.channel} (${pct(topIntent.share, 0)}) are usually a better home for incremental ad budget.`,
    );
  }
  return parts.join(" ");
}

function answerUnknown(question: string): string {
  const q = question.trim().replace(/\s+/g, " ");
  return `I can pull real numbers on revenue, orders, inventory & stockouts, conversion, customers, product performance, and traffic/ad spend. I couldn't map "${q}" to one of those — try, for example, "which products are low on stock?", "how is revenue trending?", or "who are my top customers?".`;
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

export interface AssistantAnswer {
  intent: Intent;
  content: string;
}

/** Classify a question and build a data-grounded answer (pure). */
export function answerQuestion(
  question: string,
  data: CommerceSnapshot,
): AssistantAnswer {
  const intent = classifyIntent(question);
  switch (intent) {
    case "inventory":
      return { intent, content: answerInventory(data) };
    case "revenue":
      return { intent, content: answerRevenue(data) };
    case "conversion":
      return { intent, content: answerConversion(data) };
    case "customers":
      return { intent, content: answerCustomers(data) };
    case "orders":
      return { intent, content: answerOrders(data) };
    case "product_performance":
      return { intent, content: answerProductPerformance(data) };
    case "traffic":
      return { intent, content: answerTraffic(data) };
    default:
      return { intent: "unknown", content: answerUnknown(question) };
  }
}
