"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./sidebar";

interface MobileNavProps {
  role: "member" | "admin";
  name: string;
  email: string;
}

/**
 * Phone navigation: a hamburger button (shown only below `md`) that opens a
 * slide-in drawer mirroring the desktop sidebar. Closes on backdrop tap,
 * Escape, or when a nav link is followed.
 */
export function MobileNav({ role, name, email }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-fg md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-line bg-canvas shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-2 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-fg"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              role={role}
              name={name}
              email={email}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
