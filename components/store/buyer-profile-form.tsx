"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useBuyerCustomer } from "@/lib/hooks/use-buyer-customer";
import { useCustomers } from "@/lib/store/customers-store";

export function BuyerProfileForm() {
  const { customer, hydrated } = useBuyerCustomer();
  const { updateCustomer } = useCustomers();
  const { toast } = useToast();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (seeded.current || !customer) return;
    seeded.current = true;
    setFirstName(customer.firstName ?? customer.name.split(" ")[0] ?? "");
    setLastName(customer.lastName ?? customer.name.split(" ").slice(1).join(" ") ?? "");
    setMobile(customer.mobile ?? "");
  }, [customer]);

  if (!hydrated || !customer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: "error", title: "First and last name are required." });
      return;
    }
    updateCustomer(customer.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobile: mobile.trim(),
    });
    toast({ variant: "success", title: "Profile updated", description: "Your details were saved." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your personal details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Labeled label="First name">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Labeled>
            <Labeled label="Last name">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Labeled>
            <Labeled label="Mobile number">
              <Input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Labeled>
            <Labeled label="Email (account identity)">
              <Input value={customer.email} disabled />
            </Labeled>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
