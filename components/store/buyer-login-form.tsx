"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/store/auth-store";

export function BuyerLoginForm({ redirectTo = "/account" }: { redirectTo?: string }) {
  const router = useRouter();
  const { loginBuyer, buyer, hydrated } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && buyer) router.replace(redirectTo);
  }, [hydrated, buyer, router, redirectTo]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await loginBuyer(email, password);
    if (result.ok) {
      router.replace(redirectTo);
    } else {
      setError(result.error ?? "Sign in failed.");
      setSubmitting(false);
    }
  };

  const signupHref =
    redirectTo && redirectTo !== "/account"
      ? `/signup?redirect=${encodeURIComponent(redirectTo)}`
      : "/signup";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your Aurora Market account.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <Field
            label="Email"
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
          />
          <Field
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            Sign In
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={signupHref} className="font-medium text-primary hover:underline">
            Create one
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
  ...props
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}
