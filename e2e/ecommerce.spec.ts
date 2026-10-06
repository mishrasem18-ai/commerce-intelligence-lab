import {
  test,
  expect,
  dataLayerPushes,
  signUpBuyer,
  skipWithoutGtm,
  stubGtm,
  type Push,
} from "./fixtures";

/**
 * The ecommerce object of every commerce push, from the list view to the
 * purchase, in one document:
 *  - every item carries item_brand and item_category, and a product keeps the
 *    same pair on every event (purchase used to send both empty);
 *  - `value` is the sum of price × quantity of the push's own items — shipping
 *    and tax are not in it (cart, checkout and purchase used to send the total);
 *  - purchase sends tax and shipping as their own fields, with transaction_id
 *    and currency.
 *
 * Needs a build with NEXT_PUBLIC_GTM_CONTAINER_ID (see .env.local). gtm.js is
 * stubbed, so the pushes stay inspectable and no hit leaves the test. The
 * order is created in the LOCAL D1.
 */

interface Item {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  price: number;
  quantity: number;
}
interface Ecommerce {
  currency: string;
  value?: number;
  transaction_id?: string;
  tax?: number;
  shipping?: number;
  items: Item[];
}
type CommercePush = Push & { event: string; ecommerce: Ecommerce };

const COMMERCE_EVENTS = [
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
];

/** Sum of price × quantity in cents, so the expectation has no float drift. */
const itemSum = (items: Item[]): number =>
  items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;

const cents = (amount: number): number => Math.round(amount * 100);

test.beforeEach(async ({ context }) => {
  await stubGtm(context);
});

test("list view → purchase: items carry brand and category, value is the item sum", async ({
  page,
  context,
  baseURL,
}) => {
  await signUpBuyer(context, baseURL!);
  await page.goto("/shop");
  await skipWithoutGtm(page);

  const commerce = async (event?: string): Promise<CommercePush[]> =>
    (await dataLayerPushes(page)).filter(
      (push): push is CommercePush => Boolean(push.ecommerce) && (!event || push.event === event),
    );
  const pushed = (event: string, count = 1) =>
    expect.poll(async () => (await commerce(event)).length, { message: event }).toBe(count);

  await pushed("view_item_list");

  // Two products from the grid, a third from its product page.
  const addButtons = page.locator("main").getByRole("button", { name: "Add to Cart", exact: true });
  await addButtons.nth(0).click();
  await addButtons.nth(1).click();
  await pushed("add_to_cart", 2);
  const thirdCard = addButtons
    .nth(2)
    .locator("xpath=ancestor::*[.//a[starts-with(@href,'/product/')]][1]");
  await thirdCard.locator("a[href^='/product/']").last().click();
  await expect(page).toHaveURL(/\/product\//);
  await pushed("select_item");
  await pushed("view_item");
  await page
    .getByRole("button", { name: "Buy Now" })
    .locator("xpath=..")
    .getByRole("button", { name: "Add to Cart" })
    .click();
  await pushed("add_to_cart", 3);
  const added = (await commerce("add_to_cart")).map((push) => push.ecommerce.items[0]);

  // Cart: three lines; the second is removed, the first goes to two units if stock allows.
  await page.locator("header a[href='/cart']").first().click();
  await expect(page).toHaveURL(/\/cart$/);
  await pushed("view_cart");
  await page.getByRole("button", { name: `Remove ${added[1].item_name}`, exact: true }).click();
  await pushed("remove_from_cart");
  const increase = page.getByRole("button", { name: "Increase quantity" }).first();
  if (await increase.isEnabled()) await increase.click();

  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await pushed("begin_checkout");
  await page.getByLabel("Mobile number").fill("+91 7000000000");
  await page.getByLabel("Mobile", { exact: true }).fill("+91 7000000000");
  await page.getByLabel("Postal code").fill("411001");
  await page.getByLabel("Address line 1").fill(`E ${Date.now().toString(36)} Ecommerce Lane`);
  await page.getByLabel("City").fill("Pune");
  await page.getByLabel("State / Region").fill("MH");
  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/ORD-[0-9A-F]+$/);
  const orderNumber = page.url().split("/").pop()!;
  await pushed("purchase");

  // One document from /shop to the confirmation, so this is the whole journey.
  // The per-event checks are soft, so one run lists every event that breaks the contract.
  const pushes = await commerce();
  expect([...new Set(pushes.map((push) => push.event))].sort()).toEqual([...COMMERCE_EVENTS].sort());

  // Brand and category: on every item, and the same for a product on every event.
  const described = new Map<string, { brand: string; category: string }>();
  for (const { event, ecommerce } of pushes) {
    expect.soft(ecommerce.items.length, `${event} has items`).toBeGreaterThan(0);
    for (const item of ecommerce.items) {
      const where = `${event}: ${item.item_id}`;
      expect.soft(item.item_brand, `${where} item_brand`).toBeTruthy();
      expect.soft(item.item_category, `${where} item_category`).toBeTruthy();
      const first = described.get(item.item_id);
      if (!first) {
        described.set(item.item_id, { brand: item.item_brand, category: item.item_category });
      } else {
        expect.soft({ brand: item.item_brand, category: item.item_category }, where).toEqual(first);
      }
    }
  }

  // Value: the items' own sum on every event that has one; no order fields before purchase.
  for (const { event, ecommerce } of pushes) {
    expect.soft(ecommerce.currency, `${event} currency`).toBe("USD");
    if (event === "view_item_list") {
      expect.soft(ecommerce.value, "a list view has no value").toBeUndefined();
    } else {
      expect.soft(ecommerce.value, `${event} value`).toBe(itemSum(ecommerce.items));
    }
    if (event !== "purchase") {
      expect.soft(ecommerce.transaction_id, `${event} transaction_id`).toBeUndefined();
      expect.soft(ecommerce.tax, `${event} tax`).toBeUndefined();
      expect.soft(ecommerce.shipping, `${event} shipping`).toBeUndefined();
    }
  }

  // Purchase: the two remaining lines, value without shipping and tax, both sent separately.
  const purchases = pushes.filter((push) => push.event === "purchase");
  expect(purchases).toHaveLength(1);
  const purchase = purchases[0].ecommerce;
  expect(purchase.items.map((item) => item.item_id).sort()).toEqual(
    [added[0].item_id, added[2].item_id].sort(),
  );
  expect(purchase.transaction_id).toBe(orderNumber);
  const subtotal = itemSum(purchase.items);
  expect(purchase.value).toBe(subtotal);
  expect(purchase.tax).toBe(Math.round(subtotal * 0.08 * 100) / 100);
  expect(purchase.shipping).toBe(subtotal >= 150 ? 0 : 9.99);
  // The order total is value + tax + shipping; value alone is less.
  expect(cents(subtotal) + cents(purchase.tax!) + cents(purchase.shipping!)).toBeGreaterThan(
    cents(purchase.value!),
  );

  // The checkout events describe the same cart as the purchase.
  for (const event of ["begin_checkout", "add_shipping_info", "add_payment_info"]) {
    const step = pushes.find((push) => push.event === event)!.ecommerce;
    expect(step.value, `${event} value`).toBe(purchase.value);
  }
});
