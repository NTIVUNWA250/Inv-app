"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-fg">Edit {label}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted transition-colors hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
              {state.error ? (
                <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
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

              <p className="text-xs text-muted">Only the fields you fill in will change.</p>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  <Save className="h-4 w-4" />
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
