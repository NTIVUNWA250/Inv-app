"use client";

import { useActionState } from "react";
import { Login01 } from "@/components/blocks/login-01";
import { VerletLogo } from "@/components/ui/verlet-logo";
import { login, type AuthFormState } from "../actions";

export function LoginForm({ error, message }: { error?: string; message?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    login,
    { error },
  );

  return (
    <Login01
      title="Sign in"
      description={message ?? "Use your work email to access the inventory."}
      error={state?.error}
      loading={pending}
      registerHref="/signup"
      logo={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
          <VerletLogo className="h-6 w-6" />
        </div>
      }
      action={formAction}
    />
  );
}
