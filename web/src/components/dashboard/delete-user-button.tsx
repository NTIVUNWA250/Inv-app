"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/(app)/admin/actions";

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Delete ${name}'s account? This permanently removes the user.`)) return;
    startTransition(async () => {
      try {
        await deleteUser(id);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete user.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete ${name}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
