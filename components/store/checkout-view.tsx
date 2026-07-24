"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Truck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderSummary } from "@/components/store/order-summary";
import {
  AddressFields,
  COUNTRY_CODES,
  EMPTY_ADDRESS,
  validateAddress,
  type AddressDraft,
} from "@/components/store/address-fields";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/store/auth-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useOrders } from "@/lib/store/orders-store";
import { useProducts } from "@/lib/store/products-store";
import { useCart } from "@/lib/store/cart-store";
import { useCartDetails } from "@/lib/hooks/use-cart-details";
import type { Address, Order, PaymentMethod } from "@/lib/data";
import { cn } from "@/lib/utils";

function newAddressId() {
  return `addr-${Date.now().toString(36)}-${Math.floor(performance.now())}`;
}

export function CheckoutView() {
  const router = useRouter();
  const { toast } = useToast();
  const { buyer, hydrated } = useAuth();
  const { getCustomer, updateCustomer, recordOrder } = useCustomers();
  const { addOrder } = useOrders();
  const { getProduct, decrementInventory } = useProducts();
  const { clear } = useCart();
  const { lines, totals } = useCartDetails();

  const customer = buyer ? getCustomer(buyer.customerId) : undefined;
  const savedAddresses = customer?.addresses ?? [];

  const [contactEmail, setContactEmail] = React.useState("");
  const [contactMobile, setContactMobile] = React.useState("");
  const [addressMode, setAddressMode] = React.useState<"saved" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = React.useState<string>("");
  const [newAddr, setNewAddr] = React.useState<AddressDraft>(EMPTY_ADDRESS);
  const [saveNewAddress, setSaveNewAddress] = React.useState(true);
  const [addrErrors, setAddrErrors] = React.useState<Partial<Record<keyof AddressDraft, string>>>({});
  const [method, setMethod] = React.useState<PaymentMethod>("Card");
  const [placing, setPlacing] = React.useState(false);
  const seeded = React.useRef(false);

  // Client backstop (middleware is the primary gate).
  React.useEffect(() => {
    if (hydrated && !buyer) router.replace("/login?redirect=/checkout");
  }, [hydrated, buyer, router]);

  // Seed contact + address defaults once the customer is available (one-time).
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (seeded.current || !customer) return;
    seeded.current = true;
    setContactEmail(customer.email);
    setContactMobile(customer.mobile ?? "");
    setNewAddr((prev) => ({
      ...prev,
      fullName: customer.name,
      mobile: customer.mobile ?? "",
    }));
    if ((customer.addresses ?? []).length > 0) {
      setAddressMode("saved");
      const def = customer.addresses!.find((a) => a.isDefault) ?? customer.addresses![0];
      setSelectedAddressId(def.id);
    }
  }, [customer]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!hydrated || !buyer || !customer) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading checkout…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground">
          Add some products before checking out.
        </p>
        <Link href="/shop" className={buttonVariants()}>
          Browse products
        </Link>
      </div>
    );
  }

  const resolveShippingAddress = (): Address | null => {
    if (addressMode === "saved") {
      const found = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!found) {
        toast({ variant: "error", title: "Select an address to continue." });
        return null;
      }
      return found;
    }
    const errors = validateAddress(newAddr);
    if (Object.keys(errors).length > 0) {
      setAddrErrors(errors);
      toast({ variant: "error", title: "Please complete the shipping address." });
      return null;
    }
    const address: Address = {
      id: newAddressId(),
      ...newAddr,
      isDefault: savedAddresses.length === 0,
    };
    if (saveNewAddress) {
      updateCustomer(customer.id, {
        addresses: [...savedAddresses, address],
      });
    }
    return address;
  };

  const placeOrder = () => {
    if (!contactEmail.trim() || !contactMobile.trim()) {
      toast({ variant: "error", title: "Enter your contact email and mobile." });
      return;
    }

    // Stock revalidation against the live product store.
    for (const line of lines) {
      const product = getProduct(line.product.id);
      if (!product || line.quantity > product.inventory) {
        toast({
          variant: "error",
          title: "Stock changed",
          description: `“${line.product.name}” no longer has enough stock. Please review your cart.`,
        });
        router.push("/cart");
        return;
      }
    }

    const shippingAddress = resolveShippingAddress();
    if (!shippingAddress) return;

    setPlacing(true);

    const now = new Date();
    const suffix = `${now.getTime().toString(36)}`.slice(-7).toUpperCase();
    const orderNumber = `ORD-${suffix}`;
    const dateStr = now.toISOString().slice(0, 10);
    const lineItems = lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      sku: l.product.sku,
      price: l.product.price,
      quantity: l.quantity,
    }));
    const itemsCount = lines.reduce((sum, l) => sum + l.quantity, 0);

    const order: Order = {
      id: `#${orderNumber}`,
      orderNumber,
      customerId: customer.id,
      customer: customer.name,
      email: contactEmail.trim(),
      country: shippingAddress.country,
      countryCode: COUNTRY_CODES[shippingAddress.country] ?? "IN",
      amount: totals.total,
      status: "Processing",
      date: dateStr,
      items: itemsCount,
      lineItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      total: totals.total,
      shippingAddress,
      paymentMethod: method,
      paymentStatus: method === "Card" ? "Paid" : "Pending",
      createdAt: now.toISOString(),
    };

    addOrder(order);
    decrementInventory(lineItems.map((li) => ({ productId: li.productId, quantity: li.quantity })));
    recordOrder(customer.id, totals.total, dateStr);
    clear();

    toast({ variant: "success", title: "Order placed", description: orderNumber });
    router.push(`/order-confirmation/${orderNumber}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        Checkout
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Contact */}
          <Section title="Contact information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Email"
                type="email"
                value={contactEmail}
                onChange={setContactEmail}
              />
              <LabeledInput
                label="Mobile number"
                type="tel"
                value={contactMobile}
                onChange={setContactMobile}
              />
            </div>
          </Section>

          {/* Shipping address */}
          <Section title="Shipping address">
            {savedAddresses.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {savedAddresses.map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      addressMode === "saved" && selectedAddressId === a.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping-address"
                      className="mt-1 accent-[color:var(--primary)]"
                      checked={addressMode === "saved" && selectedAddressId === a.id}
                      onChange={() => {
                        setAddressMode("saved");
                        setSelectedAddressId(a.id);
                      }}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-foreground">{a.fullName}</span>
                      {a.isDefault && (
                        <span className="ml-2 text-xs text-primary">Default</span>
                      )}
                      <span className="block text-muted-foreground">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}{" "}
                        {a.postalCode}, {a.country}
                      </span>
                      <span className="block text-muted-foreground">{a.mobile}</span>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setAddressMode("new")}
                  className={cn(
                    "self-start rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    addressMode === "new"
                      ? "bg-primary/10 text-primary"
                      : "text-primary hover:bg-accent/40",
                  )}
                >
                  + Use a new address
                </button>
              </div>
            )}

            {addressMode === "new" && (
              <div className="flex flex-col gap-4">
                <AddressFields
                  value={newAddr}
                  onChange={(k, v) => setNewAddr((prev) => ({ ...prev, [k]: v }))}
                  errors={addrErrors}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--primary)]"
                    checked={saveNewAddress}
                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                  />
                  Save this address to my account
                </label>
              </div>
            )}
          </Section>

          {/* Payment */}
          <Section title="Payment method">
            <div className="flex flex-col gap-2">
              <PaymentOption
                active={method === "Card"}
                onSelect={() => setMethod("Card")}
                icon={<CreditCard className="size-5" />}
                title="Credit / Debit Card"
                subtitle="Demo — no real card is charged"
              />
              <PaymentOption
                active={method === "COD"}
                onSelect={() => setMethod("COD")}
                icon={<Wallet className="size-5" />}
                title="Cash on Delivery"
                subtitle="Pay when your order arrives"
              />
            </div>

            {method === "Card" && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Demo checkout — use any test values. Card details are never stored.
                </p>
                <LabeledInput label="Name on card" value="" onChange={() => {}} placeholder="Test User" className="sm:col-span-2" />
                <LabeledInput label="Card number" value="" onChange={() => {}} placeholder="4242 4242 4242 4242" className="sm:col-span-2" />
                <LabeledInput label="Expiry" value="" onChange={() => {}} placeholder="12 / 28" />
                <LabeledInput label="CVC" value="" onChange={() => {}} placeholder="123" />
              </div>
            )}
          </Section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="flex flex-col gap-4 p-5">
              <h2 className="text-base font-semibold text-foreground">Order Summary</h2>
              <div className="flex flex-col gap-2">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {l.quantity} × {l.product.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <OrderSummary totals={totals} />
              </div>
              <Button onClick={placeOrder} disabled={placing} size="lg" className="w-full">
                <Truck />
                Place Order
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By placing this order you agree to our demo terms.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  className,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}

function PaymentOption({
  active,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "size-4 rounded-full border-2",
          active ? "border-primary bg-primary" : "border-border",
        )}
      />
    </button>
  );
}
