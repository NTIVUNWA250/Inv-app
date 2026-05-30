"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Warehouse, Boxes, Users, Settings, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: "member" | "admin";
  name: string;
  email: string;
}

const baseNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/locations", label: "Locations", icon: Warehouse },
];
const adminNav = [
  { href: "/items", label: "Items", icon: Boxes },
  { href: "/users", label: "Users", icon: Users },
];

export function Sidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname();
  const nav = role === "admin" ? [...baseNav, ...adminNav] : baseNav;
  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-600 text-white">
          <Package className="h-5 w-5" />
        </div>
        <span className="text-base font-semibold text-fg">Inventory</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-fg"
                  : "text-muted hover:bg-surface hover:text-fg",
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
          className={cn(
            "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
            settingsActive ? "bg-surface-2" : "hover:bg-surface",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-400 ring-2 ring-emerald-500/40">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Settings className="h-4 w-4 shrink-0 text-muted" />
        </Link>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
