"use client";

import { useTransition } from "react";
import { Ban, CircleCheck } from "lucide-react";
import { setBlocked } from "@/app/(app)/admin/actions";

export function BlockUserButton({
  id,
  name,
  blocked,
}: {
  id: string;
  name: string;
  blocked: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const verb = blocked ? "Unblock" : "Block";
    if (!window.confirm(`${verb} ${name}?`)) return;
    startTransition(async () => {
      try {
        await setBlocked(id, !blocked);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : `Could not ${verb.toLowerCase()} user.`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`${blocked ? "Unblock" : "Block"} ${name}`}
      title={blocked ? "Unblock user" : "Block user"}
      className={
        blocked
          ? "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
          : "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50"
      }
    >
      {blocked ? <CircleCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
    </button>
  );
}
