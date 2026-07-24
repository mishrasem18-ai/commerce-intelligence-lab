/**
 * Static demo dataset for Commerce Intelligence Lab.
 * All values are fabricated for presentation — no backend, no APIs.
 */

export type TrendDirection = "up" | "down" | "flat";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  rawValue: number;
  delta: number; // fractional change vs. previous period
  direction: TrendDirection;
  hint: string;
  spark: number[];
}

export const kpis: Kpi[] = [
  {
    id: "revenue",
    label: "Revenue",
    value: "$128,450",
    rawValue: 128450,
    delta: 0.124,
    direction: "up",
    hint: "vs. last month",
    spark: [82, 90, 88, 96, 102, 99, 110, 118, 121, 116, 124, 128],
  },
  {
    id: "orders",
    label: "Orders",
    value: "3,248",
    rawValue: 3248,
    delta: 0.086,
    direction: "up",
    hint: "vs. last month",
    spark: [210, 240, 255, 248, 268, 279, 290, 305, 298, 312, 320, 325],
  },
  {
    id: "customers",
    label: "Customers",
    value: "1,876",
    rawValue: 1876,
    delta: 0.052,
    direction: "up",
    hint: "vs. last month",
    spark: [120, 132, 141, 150, 149, 158, 165, 170, 168, 176, 182, 187],
  },
  {
    id: "conversion",
    label: "Conversion",
    value: "3.84%",
    rawValue: 0.0384,
    delta: -0.007,
    direction: "down",
    hint: "vs. last month",
    spark: [4.1, 4.0, 3.9, 4.0, 3.95, 3.88, 3.9, 3.86, 3.9, 3.85, 3.87, 3.84],
  },
  {
    id: "aov",
    label: "Avg. Order Value",
    value: "$72.30",
    rawValue: 72.3,
    delta: 0.031,
    direction: "up",
    hint: "vs. last month",
    spark: [66, 67, 68, 67, 69, 70, 69, 71, 70, 71, 72, 72.3],
  },
  {
    id: "returning",
    label: "Returning Customers",
    value: "42%",
    rawValue: 0.42,
    delta: 0.018,
    direction: "up",
    hint: "vs. last month",
    spark: [37, 38, 38, 39, 40, 39, 40, 41, 41, 41, 42, 42],
  },
];

export interface MonthlyPoint {
  month: string;
  revenue: number;
  orders: number;
  profit: number;
}

export const monthlySeries: MonthlyPoint[] = [
  { month: "Aug", revenue: 82400, orders: 2110, profit: 24100 },
  { month: "Sep", revenue: 90100, orders: 2405, profit: 27600 },
  { month: "Oct", revenue: 88700, orders: 2288, profit: 26300 },
  { month: "Nov", revenue: 96500, orders: 2481, profit: 29900 },
  { month: "Dec", revenue: 118200, orders: 2790, profit: 38400 },
  { month: "Jan", revenue: 99300, orders: 2612, profit: 30100 },
  { month: "Feb", revenue: 104800, orders: 2705, profit: 33200 },
  { month: "Mar", revenue: 112400, orders: 2903, profit: 35800 },
  { month: "Apr", revenue: 108900, orders: 2844, profit: 34100 },
  { month: "May", revenue: 116700, orders: 3021, profit: 37500 },
  { month: "Jun", revenue: 122300, orders: 3156, profit: 39900 },
  { month: "Jul", revenue: 128450, orders: 3248, profit: 42600 },
];

export interface TrafficSource {
  channel: string;
  visitors: number;
  share: number;
}

export const trafficSources: TrafficSource[] = [
  { channel: "Organic Search", visitors: 42100, share: 0.38 },
  { channel: "Direct", visitors: 26500, share: 0.24 },
  { channel: "Paid Social", visitors: 17800, share: 0.16 },
  { channel: "Email", visitors: 13200, share: 0.12 },
  { channel: "Referral", visitors: 11000, share: 0.1 },
];

export interface CountryRevenue {
  country: string;
  code: string;
  revenue: number;
  orders: number;
}

export const countryRevenue: CountryRevenue[] = [
  { country: "United States", code: "US", revenue: 58200, orders: 1420 },
  { country: "United Kingdom", code: "GB", revenue: 21400, orders: 561 },
  { country: "Germany", code: "DE", revenue: 16800, orders: 438 },
  { country: "Canada", code: "CA", revenue: 12900, orders: 331 },
  { country: "Australia", code: "AU", revenue: 9600, orders: 248 },
  { country: "France", code: "FR", revenue: 9550, orders: 250 },
];

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  price: number;
  trend: number;
}

export const products: Product[] = [
  { id: "P-1042", name: "Aurora Wireless Headphones", sku: "AUR-WH-01", category: "Audio", unitsSold: 1284, revenue: 128400, stock: 342, price: 99.0, trend: 0.14 },
  { id: "P-1043", name: "Nimbus Smart Speaker", sku: "NMB-SS-02", category: "Audio", unitsSold: 968, revenue: 87120, stock: 128, price: 90.0, trend: 0.08 },
  { id: "P-1044", name: "Vertex Mechanical Keyboard", sku: "VTX-KB-03", category: "Accessories", unitsSold: 842, revenue: 75780, stock: 76, price: 90.0, trend: 0.22 },
  { id: "P-1045", name: "Lumen 4K Webcam", sku: "LMN-WC-04", category: "Video", unitsSold: 731, revenue: 65790, stock: 54, price: 90.0, trend: -0.05 },
  { id: "P-1046", name: "Pulse Fitness Tracker", sku: "PLS-FT-05", category: "Wearables", unitsSold: 690, revenue: 55200, stock: 12, price: 80.0, trend: 0.11 },
  { id: "P-1047", name: "Cobalt USB-C Hub", sku: "CBL-UH-06", category: "Accessories", unitsSold: 654, revenue: 32700, stock: 0, price: 50.0, trend: -0.12 },
  { id: "P-1048", name: "Halo Desk Lamp", sku: "HLO-DL-07", category: "Home", unitsSold: 588, revenue: 29400, stock: 210, price: 50.0, trend: 0.06 },
  { id: "P-1049", name: "Drift Ergonomic Mouse", sku: "DRF-EM-08", category: "Accessories", unitsSold: 542, revenue: 27100, stock: 96, price: 50.0, trend: 0.03 },
];

export type OrderStatus =
  | "Processing"
  | "Paid"
  | "Pending"
  | "Shipped"
  | "Refunded"
  | "Cancelled";

export type PaymentMethod = "Card" | "COD";
export type PaymentStatus = "Paid" | "Pending" | "Refunded";

export interface Address {
  id: string;
  fullName: string;
  mobile: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customer: string;
  email: string;
  country: string;
  countryCode: string;
  amount: number;
  status: OrderStatus;
  date: string;
  items: number;
  // Buyer-created order extensions (seed orders leave these undefined).
  orderNumber?: string;
  customerId?: string;
  lineItems?: OrderLineItem[];
  subtotal?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  shippingAddress?: Address;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  createdAt?: string;
}

export const orders: Order[] = [
  { id: "#ORD-7841", customer: "Mia Thornton", email: "mia.t@example.com", country: "United States", countryCode: "US", amount: 248.0, status: "Paid", date: "2026-07-24", items: 3 },
  { id: "#ORD-7840", customer: "Liam Ford", email: "liam.f@example.com", country: "United Kingdom", countryCode: "GB", amount: 96.5, status: "Shipped", date: "2026-07-24", items: 1 },
  { id: "#ORD-7839", customer: "Noah Bennett", email: "noah.b@example.com", country: "Germany", countryCode: "DE", amount: 412.9, status: "Pending", date: "2026-07-23", items: 5 },
  { id: "#ORD-7838", customer: "Olivia Reyes", email: "olivia.r@example.com", country: "Canada", countryCode: "CA", amount: 132.0, status: "Paid", date: "2026-07-23", items: 2 },
  { id: "#ORD-7837", customer: "Ethan Walsh", email: "ethan.w@example.com", country: "Australia", countryCode: "AU", amount: 78.3, status: "Refunded", date: "2026-07-22", items: 1 },
  { id: "#ORD-7836", customer: "Ava Sinclair", email: "ava.s@example.com", country: "France", countryCode: "FR", amount: 189.9, status: "Paid", date: "2026-07-22", items: 3 },
  { id: "#ORD-7835", customer: "Lucas Meyer", email: "lucas.m@example.com", country: "Germany", countryCode: "DE", amount: 54.0, status: "Cancelled", date: "2026-07-21", items: 1 },
  { id: "#ORD-7834", customer: "Sophia Nguyen", email: "sophia.n@example.com", country: "United States", countryCode: "US", amount: 320.75, status: "Shipped", date: "2026-07-21", items: 4 },
  { id: "#ORD-7833", customer: "James Okafor", email: "james.o@example.com", country: "United Kingdom", countryCode: "GB", amount: 145.2, status: "Paid", date: "2026-07-20", items: 2 },
  { id: "#ORD-7832", customer: "Isabella Rossi", email: "bella.r@example.com", country: "Italy", countryCode: "IT", amount: 267.4, status: "Pending", date: "2026-07-20", items: 3 },
  { id: "#ORD-7831", customer: "Benjamin Cole", email: "ben.c@example.com", country: "United States", countryCode: "US", amount: 89.99, status: "Paid", date: "2026-07-19", items: 1 },
  { id: "#ORD-7830", customer: "Charlotte Kim", email: "charlotte.k@example.com", country: "Canada", countryCode: "CA", amount: 203.5, status: "Shipped", date: "2026-07-19", items: 2 },
];

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  countryCode: string;
  orders: number;
  spent: number;
  status: "Active" | "New" | "At Risk" | "VIP";
  lastSeen: string;
  // Buyer-account extensions (seed customers leave these undefined).
  firstName?: string;
  lastName?: string;
  mobile?: string;
  addresses?: Address[];
  lastOrderDate?: string;
  joinedAt?: string;
}

export const customers: Customer[] = [
  { id: "C-2201", name: "Mia Thornton", email: "mia.t@example.com", country: "United States", countryCode: "US", orders: 24, spent: 4820, status: "VIP", lastSeen: "2h ago" },
  { id: "C-2202", name: "Noah Bennett", email: "noah.b@example.com", country: "Germany", countryCode: "DE", orders: 18, spent: 3610, status: "Active", lastSeen: "5h ago" },
  { id: "C-2203", name: "Ava Sinclair", email: "ava.s@example.com", country: "France", countryCode: "FR", orders: 15, spent: 2940, status: "Active", lastSeen: "1d ago" },
  { id: "C-2204", name: "Liam Ford", email: "liam.f@example.com", country: "United Kingdom", countryCode: "GB", orders: 12, spent: 2180, status: "Active", lastSeen: "1d ago" },
  { id: "C-2205", name: "Sophia Nguyen", email: "sophia.n@example.com", country: "United States", countryCode: "US", orders: 9, spent: 1760, status: "At Risk", lastSeen: "12d ago" },
  { id: "C-2206", name: "Olivia Reyes", email: "olivia.r@example.com", country: "Canada", countryCode: "CA", orders: 6, spent: 1120, status: "Active", lastSeen: "3d ago" },
  { id: "C-2207", name: "James Okafor", email: "james.o@example.com", country: "United Kingdom", countryCode: "GB", orders: 3, spent: 540, status: "New", lastSeen: "6h ago" },
  { id: "C-2208", name: "Isabella Rossi", email: "bella.r@example.com", country: "Italy", countryCode: "IT", orders: 2, spent: 410, status: "New", lastSeen: "8h ago" },
];

export type ActivityKind = "order" | "customer" | "refund" | "product" | "review";

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  time: string;
}

export const activityFeed: Activity[] = [
  { id: "a1", kind: "order", title: "New order #ORD-7841", detail: "Mia Thornton · $248.00", time: "2m ago" },
  { id: "a2", kind: "customer", title: "New customer signed up", detail: "James Okafor · United Kingdom", time: "18m ago" },
  { id: "a3", kind: "product", title: "Low stock alert", detail: "Pulse Fitness Tracker · 12 left", time: "42m ago" },
  { id: "a4", kind: "review", title: "New 5★ review", detail: "Aurora Wireless Headphones", time: "1h ago" },
  { id: "a5", kind: "refund", title: "Refund processed", detail: "Ethan Walsh · $78.30", time: "2h ago" },
  { id: "a6", kind: "order", title: "New order #ORD-7834", detail: "Sophia Nguyen · $320.75", time: "3h ago" },
];

export interface Notification {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  tone: "info" | "success" | "warning";
}

export const notifications: Notification[] = [
  { id: "n1", title: "Revenue goal reached", detail: "July target hit 6 days early.", time: "1h ago", unread: true, tone: "success" },
  { id: "n2", title: "Inventory running low", detail: "2 products below threshold.", time: "3h ago", unread: true, tone: "warning" },
  { id: "n3", title: "Weekly report ready", detail: "Your commerce digest is available.", time: "1d ago", unread: false, tone: "info" },
];

export interface SummaryStat {
  label: string;
  value: string;
  direction: TrendDirection;
  delta: string;
}

export const todaySummary: SummaryStat[] = [
  { label: "Revenue today", value: "$8,240", direction: "up", delta: "+9.2%" },
  { label: "Orders today", value: "142", direction: "up", delta: "+6.1%" },
  { label: "New customers", value: "38", direction: "up", delta: "+3.4%" },
  { label: "Refund rate", value: "1.2%", direction: "down", delta: "-0.4%" },
];

export interface Report {
  id: string;
  name: string;
  description: string;
  period: string;
  updated: string;
  format: "PDF" | "CSV" | "XLSX";
  status: "Ready" | "Scheduled" | "Generating";
}

export const reports: Report[] = [
  { id: "R-01", name: "Monthly Revenue Summary", description: "Revenue, profit and AOV across all channels.", period: "Jul 2026", updated: "2h ago", format: "PDF", status: "Ready" },
  { id: "R-02", name: "Product Performance", description: "Units sold, revenue and stock by product.", period: "Jul 2026", updated: "5h ago", format: "XLSX", status: "Ready" },
  { id: "R-03", name: "Customer Cohorts", description: "Retention and LTV by acquisition cohort.", period: "Q2 2026", updated: "1d ago", format: "CSV", status: "Ready" },
  { id: "R-04", name: "Traffic & Conversion", description: "Sessions, conversion and channel mix.", period: "Jul 2026", updated: "Scheduled", format: "PDF", status: "Scheduled" },
  { id: "R-05", name: "Refunds & Returns", description: "Refund volume, reasons and rate trend.", period: "Jul 2026", updated: "Generating", format: "CSV", status: "Generating" },
];

export interface FunnelStage {
  stage: string;
  value: number;
}

export const conversionFunnel: FunnelStage[] = [
  { stage: "Visits", value: 112000 },
  { stage: "Product Views", value: 68400 },
  { stage: "Add to Cart", value: 24600 },
  { stage: "Checkout", value: 9800 },
  { stage: "Purchase", value: 4302 },
];

export interface DeviceShare {
  device: string;
  share: number;
}

export const deviceMix: DeviceShare[] = [
  { device: "Mobile", share: 0.58 },
  { device: "Desktop", share: 0.34 },
  { device: "Tablet", share: 0.08 },
];

export interface AiSuggestion {
  id: string;
  prompt: string;
}

export const aiSuggestions: AiSuggestion[] = [
  { id: "s1", prompt: "Why did conversion dip this month?" },
  { id: "s2", prompt: "Which products are at risk of stockout?" },
  { id: "s3", prompt: "Summarize revenue performance vs. last quarter." },
  { id: "s4", prompt: "Where should I focus ad spend next month?" },
];

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const aiConversation: AiMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "How is revenue trending this month?",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "Revenue reached $128,450 in July — up 12.4% month-over-month and your strongest month in the trailing year. Growth is led by the Audio category (Aurora Headphones +14%) and stronger returning-customer activity, now 42% of orders. The one soft spot is conversion, down 0.7pts to 3.84%, largely from higher paid-social traffic that converts below your site average.",
  },
];
