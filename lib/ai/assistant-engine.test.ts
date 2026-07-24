/**
 * Regression tests for the AI Assistant intent engine.
 *
 * Run with Node's built-in test runner + type stripping (Node >= 22):
 *   node --experimental-strip-types --test lib/ai/assistant-engine.test.ts
 * (wired up as `npm run test:ai`).
 *
 * The engine is pure, so these tests need no DOM, no React and no build step.
 * They guard the exact production bug: unrelated questions must NOT fall
 * through to one generic commerce summary, and each category must route to —
 * and answer from — the right underlying data.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyIntent,
  answerQuestion,
  type CommerceSnapshot,
  type Intent,
} from "./assistant-engine.ts";

/* ----------------------------- mock commerce data ----------------------------- */

const snapshot: CommerceSnapshot = {
  products: [
    { id: "p1", sku: "AAA", name: "The Silent Ledger Pro", description: "", category: "Books", brand: "Marginalia", price: 43.99, cost: 10, inventory: 1, status: "Active", rating: 3.8, image: "", unitsSold: 12, revenue: 500, createdAt: "", updatedAt: "" },
    { id: "p2", sku: "BBB", name: "Vanta Cycling Helmet", description: "", category: "Sports", brand: "Vanta", price: 164.99, cost: 60, inventory: 18, status: "Active", rating: 4.4, image: "", unitsSold: 300, revenue: 49000, createdAt: "", updatedAt: "" },
    { id: "p3", sku: "CCC", name: "Field Keychain Studio", description: "", category: "Accessories", brand: "Field", price: 27.99, cost: 8, inventory: 0, status: "Active", rating: 4.8, image: "", unitsSold: 900, revenue: 25000, createdAt: "", updatedAt: "" },
    { id: "p4", sku: "DDD", name: "Nimbus Bluetooth Tracker Max", description: "", category: "Electronics", brand: "Nimbus", price: 316.99, cost: 120, inventory: 400, status: "Active", rating: 5, image: "", unitsSold: 1500, revenue: 470000, createdAt: "", updatedAt: "" },
  ] as CommerceSnapshot["products"],
  orders: [
    { id: "#ORD-1", customer: "Mia Thornton", email: "", country: "US", countryCode: "US", amount: 248, status: "Paid", date: "2026-07-24", items: 3 },
    { id: "#ORD-2", customer: "Noah Bennett", email: "", country: "DE", countryCode: "DE", amount: 412.9, status: "Pending", date: "2026-07-23", items: 5 },
    { id: "#ORD-3", customer: "Ethan Walsh", email: "", country: "AU", countryCode: "AU", amount: 78.3, status: "Refunded", date: "2026-07-22", items: 1 },
  ] as CommerceSnapshot["orders"],
  customers: [
    { id: "C-1", name: "Mia Thornton", email: "", country: "US", countryCode: "US", orders: 24, spent: 4820, status: "VIP", lastSeen: "2h ago" },
    { id: "C-2", name: "Sophia Nguyen", email: "", country: "US", countryCode: "US", orders: 9, spent: 1760, status: "At Risk", lastSeen: "12d ago" },
    { id: "C-3", name: "James Okafor", email: "", country: "GB", countryCode: "GB", orders: 3, spent: 540, status: "New", lastSeen: "6h ago" },
  ] as CommerceSnapshot["customers"],
  kpis: [
    { id: "revenue", label: "Revenue", value: "$128,450", rawValue: 128450, delta: 0.124, direction: "up", hint: "", spark: [] },
    { id: "conversion", label: "Conversion", value: "3.84%", rawValue: 0.0384, delta: -0.007, direction: "down", hint: "", spark: [] },
    { id: "aov", label: "Avg. Order Value", value: "$72.30", rawValue: 72.3, delta: 0.031, direction: "up", hint: "", spark: [] },
    { id: "returning", label: "Returning Customers", value: "42%", rawValue: 0.42, delta: 0.018, direction: "up", hint: "", spark: [] },
  ] as CommerceSnapshot["kpis"],
  monthly: [
    { month: "Feb", revenue: 104800, orders: 2705, profit: 33200 },
    { month: "Mar", revenue: 112400, orders: 2903, profit: 35800 },
    { month: "Apr", revenue: 108900, orders: 2844, profit: 34100 },
    { month: "May", revenue: 116700, orders: 3021, profit: 37500 },
    { month: "Jun", revenue: 122300, orders: 3156, profit: 39900 },
    { month: "Jul", revenue: 128450, orders: 3248, profit: 42600 },
  ],
  traffic: [
    { channel: "Organic Search", visitors: 42100, share: 0.38 },
    { channel: "Direct", visitors: 26500, share: 0.24 },
    { channel: "Paid Social", visitors: 17800, share: 0.16 },
  ],
  funnel: [
    { stage: "Visits", value: 112000 },
    { stage: "Product Views", value: 68400 },
    { stage: "Add to Cart", value: 24600 },
    { stage: "Checkout", value: 9800 },
    { stage: "Purchase", value: 4302 },
  ],
  lowStockThreshold: 25,
};

/* ------------------------------ intent routing ------------------------------ */

const intentCases: { q: string; intent: Intent }[] = [
  // The four built-in suggested prompts.
  { q: "Why did conversion dip this month?", intent: "conversion" },
  { q: "Which products are at risk of stockout?", intent: "inventory" },
  { q: "Summarize revenue performance vs. last quarter.", intent: "revenue" },
  { q: "Where should I focus ad spend next month?", intent: "traffic" },
  // Semantically similar, natural-language paraphrases.
  { q: "what items are running low on stock", intent: "inventory" },
  { q: "do we have anything out of stock right now?", intent: "inventory" },
  { q: "which products need to be reordered", intent: "inventory" },
  { q: "how much money did we make", intent: "revenue" },
  { q: "show me total sales this month", intent: "revenue" },
  { q: "what's our checkout conversion looking like", intent: "conversion" },
  { q: "why are people abandoning their carts", intent: "conversion" },
  { q: "who are my best customers", intent: "customers" },
  { q: "how many customers are at risk of churn", intent: "customers" },
  { q: "list my most recent orders", intent: "orders" },
  { q: "how many refunds did we get", intent: "orders" },
  { q: "what is the average order value", intent: "orders" },
  { q: "what are my best-selling products", intent: "product_performance" },
  { q: "which product has the most units sold", intent: "product_performance" },
  { q: "how is my paid social traffic performing", intent: "traffic" },
  { q: "which marketing channel should I invest in", intent: "traffic" },
];

for (const { q, intent } of intentCases) {
  test(`intent: "${q}" -> ${intent}`, () => {
    assert.equal(classifyIntent(q), intent);
  });
}

// Unrelated questions must NOT fall through to a commerce intent.
const unrelated = [
  "hello there",
  "what's the weather today?",
  "tell me a joke",
  "who won the world cup",
  "what is the meaning of life",
  "can you write me a poem",
];
for (const q of unrelated) {
  test(`unrelated: "${q}" -> unknown`, () => {
    assert.equal(classifyIntent(q), "unknown");
  });
}

/* --------------------------- data-grounded answers --------------------------- */

test("stockout question returns specific product names + low/out counts", () => {
  const { intent, content } = answerQuestion("Which products are at risk of stockout?", snapshot);
  assert.equal(intent, "inventory");
  assert.match(content, /The Silent Ledger Pro/); // lowest-inventory item, 1 left
  assert.match(content, /1 left/);
  assert.match(content, /out of stock/i);
  assert.match(content, /Field Keychain Studio/); // the out-of-stock item
  // Must NOT be the old generic summary.
  assert.doesNotMatch(content, /Aurora Headphones/);
  assert.doesNotMatch(content, /paid-social targeting/);
});

test("revenue question uses revenue data, not inventory", () => {
  const { intent, content } = answerQuestion("how is revenue trending?", snapshot);
  assert.equal(intent, "revenue");
  assert.match(content, /\$128,450/);
  assert.doesNotMatch(content, /out of stock/i);
});

test("conversion question uses conversion + funnel data", () => {
  const { intent, content } = answerQuestion("why did conversion dip?", snapshot);
  assert.equal(intent, "conversion");
  assert.match(content, /3\.84%/);
  assert.match(content, /drop-off/i);
});

test("customers question uses customer data", () => {
  const { intent, content } = answerQuestion("who are my top customers?", snapshot);
  assert.equal(intent, "customers");
  assert.match(content, /Mia Thornton/); // top spender in mock
  assert.match(content, /VIP/);
});

test("orders question uses order data", () => {
  const { intent, content } = answerQuestion("show my recent orders", snapshot);
  assert.equal(intent, "orders");
  assert.match(content, /3 orders/);
  assert.match(content, /Mia Thornton|Noah Bennett/);
});

test("product-performance question uses product/order data", () => {
  const { intent, content } = answerQuestion("what are my best sellers?", snapshot);
  assert.equal(intent, "product_performance");
  assert.match(content, /Nimbus Bluetooth Tracker Max/); // top revenue + units
  assert.match(content, /sold/);
});

test("unknown question returns scoped help, never the generic commerce summary", () => {
  const { intent, content } = answerQuestion("tell me a joke", snapshot);
  assert.equal(intent, "unknown");
  assert.match(content, /revenue, orders, inventory/);
  assert.doesNotMatch(content, /Aurora Headphones/);
  assert.doesNotMatch(content, /\$128,450/);
});

test("different intents never produce identical answers (no shared canned reply)", () => {
  const questions = [
    "which products are at risk of stockout?",
    "how is revenue trending?",
    "why did conversion dip?",
    "who are my top customers?",
    "show my recent orders",
    "what are my best sellers?",
    "where should I focus ad spend?",
    "tell me a joke",
  ];
  const answers = questions.map((q) => answerQuestion(q, snapshot).content);
  assert.equal(new Set(answers).size, answers.length, "answers should all differ");
});
