"use client";

import { useState } from "react";
import { Login01 } from "@/components/blocks/login-01";
import { VerletLogo } from "@/components/ui/verlet-logo";
import { login } from "../actions";

export function LoginForm({ error, message }: { error?: string; message?: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <Login01
      title="Sign in"
      description={message ?? "Use your work email to access the inventory."}
      error={error}
      loading={loading}
      registerHref="/signup"
      logo={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
          <VerletLogo className="h-6 w-6" />
        </div>
      }
      onSubmit={(data) => {
        setLoading(true);
        const fd = new FormData();
        fd.set("email", data.email);
        fd.set("password", data.password);
        login(fd);
      }}
    />
  );
}
