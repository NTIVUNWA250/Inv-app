"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Warehouse, Boxes, Users, Settings, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerletLogo } from "@/components/ui/verlet-logo";

interface SidebarProps {
  role: "member" | "admin";
  name: string;
  email: string;
}

const baseNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/locations", label: "Locations", icon: Warehouse },
  { href: "/payments", label: "Payment", icon: Wallet },
];
const adminNav = [
  { href: "/items", label: "Items", icon: Boxes },
  { href: "/users", label: "Users", icon: Users },
];

/**
 * The logo + nav links + settings block. Shared by the desktop sidebar and the
 * mobile drawer; `onNavigate` lets the drawer close itself when a link is tapped.
 */
export function SidebarContent({
  role,
  name,
  email,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  // BACKEND TODO: Once the payment permission is integrated into the user profile database schema:
  // 1. Pass the logged-in user's payment permission status (e.g. `paymentPermission: boolean`) to the Sidebar.
  // 2. Filter out the "/payments" link from `nav` if the user role is "member" and they lack payment permission.
  // Example:
  // const nav = role === "admin"
  //   ? [...baseNav, ...adminNav]
  //   : baseNav.filter(item => item.href !== "/payments" || paymentPermission);
  const nav = role === "admin" ? [...baseNav, ...adminNav] : baseNav;
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
          <VerletLogo className="h-5 w-5" />
        </div>
        <span className="text-base font-semibold text-foreground">Inventory</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-fg"
                  : "text-muted-foreground hover:bg-card hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom block is the Settings entry: profile + theme + sign out live there. */}
      <div className="border-t border-line p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
            settingsActive ? "bg-surface-2" : "hover:bg-card",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-highlight-soft text-sm font-semibold text-highlight ring-2 ring-highlight/30">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </>
  );
}

/** Desktop sidebar: fixed rail, hidden below the `md` breakpoint. */
export function Sidebar({ role, name, email }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas md:flex">
      <SidebarContent role={role} name={name} email={email} />
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
