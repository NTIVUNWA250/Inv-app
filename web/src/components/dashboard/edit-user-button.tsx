"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { editUser, type EditUserState } from "@/app/(app)/admin/actions";

/**
 * Per-row admin action: edit another user's name, email, and/or password.
 * Opens a small modal (the rest of the app uses inline panels, but a per-row
 * editor reads better as an overlay). Only filled-in fields are submitted.
 */
export function EditUserButton({ id, fullName }: { id: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<EditUserState, FormData>(
    editUser.bind(null, id),
    {},
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const label = fullName || "this user";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${label}`}
        title="Edit user"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {label}</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="mt-4 space-y-4">
            {state.error ? (
              <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`edit-name-${id}`}>Full name</Label>
              <Input
                id={`edit-name-${id}`}
                name="full_name"
                defaultValue={fullName}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-email-${id}`}>Email</Label>
              <Input
                id={`edit-email-${id}`}
                name="email"
                type="email"
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-password-${id}`}>New password</Label>
              <Input
                id={`edit-password-${id}`}
                name="password"
                type="text"
                minLength={6}
                placeholder="Leave blank to keep current"
              />
            </div>

            <p className="text-xs text-muted-foreground">Only the fields you fill in will change.</p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
