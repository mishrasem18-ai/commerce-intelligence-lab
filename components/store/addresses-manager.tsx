"use client";

import * as React from "react";
import { Check, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  AddressFields,
  EMPTY_ADDRESS,
  validateAddress,
  type AddressDraft,
} from "@/components/store/address-fields";
import { useBuyerCustomer } from "@/lib/hooks/use-buyer-customer";
import { useCustomers } from "@/lib/store/customers-store";
import type { Address } from "@/lib/data";
import { cn } from "@/lib/utils";

function draftFrom(address: Address): AddressDraft {
  return {
    fullName: address.fullName,
    mobile: address.mobile,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
}

function newAddressId() {
  return `addr-${Date.now().toString(36)}-${Math.floor(performance.now())}`;
}

export function AddressesManager() {
  const { customer, hydrated } = useBuyerCustomer();
  const { updateCustomer } = useCustomers();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AddressDraft>(EMPTY_ADDRESS);
  const [errors, setErrors] = React.useState<Partial<Record<keyof AddressDraft, string>>>({});
  const [pendingDelete, setPendingDelete] = React.useState<Address | null>(null);

  if (!hydrated || !customer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const addresses = customer.addresses ?? [];

  const openAdd = () => {
    setDraft({ ...EMPTY_ADDRESS, fullName: customer.name, mobile: customer.mobile ?? "" });
    setErrors({});
    setEditingId(null);
    setMode("add");
  };

  const openEdit = (address: Address) => {
    setDraft(draftFrom(address));
    setErrors({});
    setEditingId(address.id);
    setMode("edit");
  };

  const persist = (next: Address[]) => updateCustomer(customer.id, { addresses: next });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateAddress(draft);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (mode === "add") {
      const address: Address = {
        id: newAddressId(),
        ...draft,
        isDefault: addresses.length === 0,
      };
      persist([...addresses, address]);
      toast({ variant: "success", title: "Address added" });
    } else if (mode === "edit" && editingId) {
      persist(addresses.map((a) => (a.id === editingId ? { ...a, ...draft } : a)));
      toast({ variant: "success", title: "Address updated" });
    }
    setMode("list");
  };

  const remove = () => {
    if (!pendingDelete) return;
    let next = addresses.filter((a) => a.id !== pendingDelete.id);
    if (pendingDelete.isDefault && next.length > 0 && !next.some((a) => a.isDefault)) {
      next = next.map((a, i) => ({ ...a, isDefault: i === 0 }));
    }
    persist(next);
    setPendingDelete(null);
    toast({ title: "Address removed" });
  };

  const setDefault = (id: string) => {
    persist(addresses.map((a) => ({ ...a, isDefault: a.id === id })));
    toast({ title: "Default address updated" });
  };

  if (mode !== "list") {
    return (
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {mode === "add" ? "Add address" : "Edit address"}
          </h2>
          <form onSubmit={save} className="flex flex-col gap-5">
            <AddressFields
              value={draft}
              onChange={(k, v) => setDraft((prev) => ({ ...prev, [k]: v }))}
              errors={errors}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMode("list")}>
                Cancel
              </Button>
              <Button type="submit">Save address</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Saved addresses</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MapPin className="size-7" />
            </span>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t saved any addresses yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className={cn(address.isDefault && "border-primary/40")}
            >
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      {address.fullName}
                      {address.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Check className="size-3" /> Default
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                      {address.state} {address.postalCode}, {address.country}
                    </p>
                    <p className="text-muted-foreground">{address.mobile}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!address.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefault(address.id)}
                    >
                      Set default
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(address)}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(address)}
                    className="text-danger hover:bg-danger/10"
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        icon={<Trash2 />}
        title="Delete address"
        description="Are you sure you want to remove this address?"
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
