"use client";

import { useState } from "react";
import { Register01 } from "@/components/blocks/register-01";
import { VerletLogo } from "@/components/ui/verlet-logo";
import { signup } from "../actions";

export function SignupForm({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <Register01
      title="Create an account"
      description="Request access to your team's inventory."
      error={error}
      loading={loading}
      loginHref="/login"
      logo={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
          <VerletLogo className="h-6 w-6" />
        </div>
      }
      onSubmit={(data) => {
        setLoading(true);
        const fd = new FormData();
        fd.set("full_name", data.name);
        fd.set("email", data.email);
        fd.set("password", data.password);
        signup(fd);
      }}
    />
  );
}
