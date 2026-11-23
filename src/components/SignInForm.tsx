"use client";

import { useActionState } from "react";
import { signIn } from "@/app/admin/actions";

export default function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="max-w-sm space-y-3 rounded-lg border border-border bg-surface p-5">
      <h1 className="text-lg font-medium">Sign in to edit</h1>
      <p className="text-sm text-muted">Use the ADMIN_PASSWORD from your settings.</p>
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        required
        autoComplete="current-password"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        placeholder="Password"
      />
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
