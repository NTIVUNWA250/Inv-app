"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removeLocation } from "@/app/(app)/admin/actions";

export function RemoveLocationButton({
  id,
  name,
  redirectTo,
}: {
  id: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Remove location "${name}"?`)) return;
    startTransition(async () => {
      try {
        await removeLocation(id);
        if (redirectTo) router.push(redirectTo);
      } catch (err) {
        // Most likely a foreign-key violation: stock still references it.
        window.alert(
          err instanceof Error
            ? err.message
            : "Could not remove location (it may still hold stock).",
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Remove ${name}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
