"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/store/auth-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[+]?[\d][\d\s-]{6,14}$/;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  confirm: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  password: "",
  confirm: "",
};

export function BuyerSignupForm({ redirectTo = "/account" }: { redirectTo?: string }) {
  const router = useRouter();
  const { signupBuyer, buyer, hydrated } = useAuth();
  const [values, setValues] = React.useState<FormState>(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState("");

  React.useEffect(() => {
    if (hydrated && buyer) router.replace(redirectTo);
  }, [hydrated, buyer, router, redirectTo]);

  const set = (key: keyof FormState, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!values.firstName.trim()) next.firstName = "Required.";
    if (!values.lastName.trim()) next.lastName = "Required.";
    if (!EMAIL_RE.test(values.email.trim())) next.email = "Enter a valid email.";
    if (!MOBILE_RE.test(values.mobile.trim()))
      next.mobile = "Enter a valid mobile number.";
    if (values.password.length < 6)
      next.password = "Use at least 6 characters.";
    if (values.confirm !== values.password) next.confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;
    const result = signupBuyer({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      mobile: values.mobile,
      password: values.password,
    });
    if (result.ok) {
      router.replace(redirectTo);
    } else {
      setFormError(result.error ?? "Sign up failed.");
    }
  };

  const loginHref =
    redirectTo && redirectTo !== "/account"
      ? `/login?redirect=${encodeURIComponent(redirectTo)}`
      : "/login";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join Aurora Market to check out faster and track orders.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" id="firstName" value={values.firstName} onChange={(v) => set("firstName", v)} error={errors.firstName} />
            <Field label="Last name" id="lastName" value={values.lastName} onChange={(v) => set("lastName", v)} error={errors.lastName} />
          </div>
          <Field label="Email" id="email" type="email" autoComplete="email" value={values.email} onChange={(v) => set("email", v)} error={errors.email} />
          <Field label="Mobile number" id="mobile" type="tel" autoComplete="tel" value={values.mobile} onChange={(v) => set("mobile", v)} error={errors.mobile} placeholder="+91 98765 43210" />
          <Field label="Password" id="password" type="password" autoComplete="new-password" value={values.password} onChange={(v) => set("password", v)} error={errors.password} />
          <Field label="Confirm password" id="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={(v) => set("confirm", v)} error={errors.confirm} />
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <Button type="submit" className="mt-1 w-full">
            Create Account
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  ...props
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
