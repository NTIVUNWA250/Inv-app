"use client";

import { useTransition } from "react";
import { CreditCard } from "lucide-react";
import { RoleSelect } from "@/components/dashboard/role-select";
import { DeleteUserButton } from "@/components/dashboard/delete-user-button";
import { BlockUserButton } from "@/components/dashboard/block-user-button";
import { EditUserButton } from "@/components/dashboard/edit-user-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { changePaymentPermission } from "@/app/(app)/admin/actions";
import type { Profile } from "@/lib/api/types";

interface UsersTableClientProps {
  initialProfiles: Profile[];
  currentUserId: string;
}

export function UsersTableClient({
  initialProfiles,
  currentUserId,
}: UsersTableClientProps) {
  const [pending, startTransition] = useTransition();

  const togglePermission = (userId: string, name: string, isCurrentlyAllowed: boolean) => {
    const target = name || "this user";
    const question = isCurrentlyAllowed
      ? `Do you want to revoke payment permission for ${target}?`
      : `Do you want to allow ${target} to make payments?`;

    if (window.confirm(question)) {
      startTransition(async () => {
        try {
          await changePaymentPermission(userId, !isCurrentlyAllowed);
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "Failed to update payment permission.");
        }
      });
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-5">Name</TableHead>
          <TableHead className="px-5">Role</TableHead>
          <TableHead className="px-5">Joined</TableHead>
          <TableHead className="px-5 text-center">Payment Permission</TableHead>
          <TableHead className="px-5 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {initialProfiles.map((p) => {
          const isAllowed = !!p.has_payment_permission;
          return (
            <TableRow key={p.id}>
              <TableCell className="px-5 font-medium text-foreground">
                <span className="inline-flex items-center gap-2">
                  {p.full_name || "—"}
                  {p.blocked ? (
                    <Badge
                      variant="chip"
                      className="bg-warning-soft text-amber-700 dark:text-warning border border-warning/25"
                    >
                      Blocked
                    </Badge>
                  ) : null}
                  {isAllowed ? (
                    <Badge
                      variant="chip"
                      className="bg-success-soft text-emerald-700 dark:text-success border border-success/25 animate-in fade-in zoom-in-95 duration-200"
                    >
                      Allowed to Pay
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="px-5">
                <RoleSelect id={p.id} role={p.role} isSelf={p.id === currentUserId} />
              </TableCell>
              <TableCell className="px-5 text-muted-foreground" suppressHydrationWarning>
                {new Date(p.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="px-5 text-center">
                {p.id === currentUserId ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => togglePermission(p.id, p.full_name || "this user", isAllowed)}
                    disabled={pending}
                    aria-label={
                      isAllowed
                        ? `Revoke payment permission for ${p.full_name || "this user"}`
                        : `Allow ${p.full_name || "this user"} to make payments`
                    }
                    title={isAllowed ? "Revoke payment permission" : "Allow to make payments"}
                    className={
                      isAllowed
                        ? "inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                        : "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/30 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                    }
                  >
                    <CreditCard className="h-4 w-4" />
                  </button>
                )}
              </TableCell>
              <TableCell className="px-5 text-right">
                {p.id === currentUserId ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <div className="flex justify-end gap-1">
                    <EditUserButton profile={p} />
                    <BlockUserButton
                      id={p.id}
                      name={p.full_name || "this user"}
                      blocked={p.blocked}
                    />
                    <DeleteUserButton id={p.id} name={p.full_name || "this user"} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
