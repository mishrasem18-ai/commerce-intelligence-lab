"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface AddressDraft {
  fullName: string;
  mobile: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export const EMPTY_ADDRESS: AddressDraft = {
  fullName: "",
  mobile: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

const COUNTRIES = ["India", "United States", "United Kingdom", "Canada", "Australia"];

export const COUNTRY_CODES: Record<string, string> = {
  India: "IN",
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Australia: "AU",
};

export function validateAddress(draft: AddressDraft): Partial<Record<keyof AddressDraft, string>> {
  const errors: Partial<Record<keyof AddressDraft, string>> = {};
  if (!draft.fullName.trim()) errors.fullName = "Required.";
  if (!/^[+]?[\d][\d\s-]{6,14}$/.test(draft.mobile.trim())) errors.mobile = "Invalid mobile.";
  if (!draft.line1.trim()) errors.line1 = "Required.";
  if (!draft.city.trim()) errors.city = "Required.";
  if (!draft.state.trim()) errors.state = "Required.";
  if (!draft.postalCode.trim()) errors.postalCode = "Required.";
  if (!draft.country.trim()) errors.country = "Required.";
  return errors;
}

export function AddressFields({
  value,
  onChange,
  errors = {},
}: {
  value: AddressDraft;
  onChange: (key: keyof AddressDraft, value: string) => void;
  errors?: Partial<Record<keyof AddressDraft, string>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name" k="fullName" value={value} onChange={onChange} errors={errors} className="sm:col-span-2" />
      <Field label="Mobile" k="mobile" value={value} onChange={onChange} errors={errors} type="tel" />
      <Field label="Postal code" k="postalCode" value={value} onChange={onChange} errors={errors} />
      <Field label="Address line 1" k="line1" value={value} onChange={onChange} errors={errors} className="sm:col-span-2" />
      <Field label="Address line 2 (optional)" k="line2" value={value} onChange={onChange} errors={errors} className="sm:col-span-2" />
      <Field label="City" k="city" value={value} onChange={onChange} errors={errors} />
      <Field label="State / Region" k="state" value={value} onChange={onChange} errors={errors} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="text-sm font-medium text-foreground">Country</label>
        <Select
          label="Country"
          value={value.country}
          onValueChange={(v) => onChange("country", v)}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  k,
  value,
  onChange,
  errors,
  className,
  type,
}: {
  label: string;
  k: keyof AddressDraft;
  value: AddressDraft;
  onChange: (key: keyof AddressDraft, value: string) => void;
  errors: Partial<Record<keyof AddressDraft, string>>;
  className?: string;
  type?: string;
}) {
  const id = React.useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value[k]}
        onChange={(e) => onChange(k, e.target.value)}
      />
      {errors[k] && <p className="text-xs text-danger">{errors[k]}</p>}
    </div>
  );
}
