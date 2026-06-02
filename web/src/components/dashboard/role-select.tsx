"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <span className="rounded-full bg-highlight/15 px-2.5 py-0.5 text-xs font-medium text-highlight">
        {role} (you)
      </span>
    );
  }

  function onChange(next: string) {
    if (next === role) return;
    startTransition(async () => {
      try {
        await changeRole(id, next as "member" | "admin");
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not change role.");
      }
    });
  }

  return (
    <Select key={role} defaultValue={role} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-[130px] text-[12px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">member</SelectItem>
        <SelectItem value="admin">admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
