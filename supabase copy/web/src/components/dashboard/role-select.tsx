"use client";

import { useTransition } from "react";
import { changeRole } from "@/app/(app)/admin/actions";

export function RoleSelect({
  id,
  role,
  isSelf,
}: {
  id: string;
  role: "member" | "admin";
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Don't let an admin change their own role here — avoids accidentally
  // locking yourself out of the admin area.
  if (isSelf) {
    return (
      <span className="rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-medium text-pink-400">
        {role} (you)
      </span>
    );
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as "member" | "admin";
    if (next === role) return;
    startTransition(async () => {
      try {
        await changeRole(id, next);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not change role.");
      }
    });
  }

  return (
    <select
      key={role}
      defaultValue={role}
      onChange={onChange}
      disabled={pending}
      className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50"
    >
      <option value="member">member</option>
      <option value="admin">admin</option>
    </select>
  );
}
