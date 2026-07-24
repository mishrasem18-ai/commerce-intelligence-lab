"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/store/auth-store";

export function AdminLoginForm() {
  const router = useRouter();
  const { signInAdmin, admin, hydrated } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Already signed in → go straight to the dashboard.
  React.useEffect(() => {
    if (hydrated && admin) router.replace("/admin/dashboard");
  }, [hydrated, admin, router]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const result = signInAdmin(email, password);
    if (result.ok) {
      router.replace("/admin/dashboard");
    } else {
      setError(result.error ?? "Sign in failed.");
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
          <Activity className="size-6" strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Commerce Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Admin sign in</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@commercelab.io"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={submitting} className="mt-1 w-full">
          <Lock />
          Sign in
        </Button>
      </form>
    </Card>
  );
}
