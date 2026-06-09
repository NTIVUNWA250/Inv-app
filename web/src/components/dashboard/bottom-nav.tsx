"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Warehouse, Boxes, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const baseNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/locations", label: "Locations", icon: Warehouse },
];
const adminNav = [
  { href: "/items", label: "Items", icon: Boxes },
  { href: "/users", label: "Users", icon: Users },
];

/**
 * Persistent bottom navigation for phone-width screens (hidden at `md`+, where
 * the left sidebar takes over). Mirrors the Flutter app's bottom tabs.
 */
export function BottomNav({ role }: { role: "member" | "admin" }) {
  const pathname = usePathname();
  const items = [
    ...(role === "admin" ? [...baseNav, ...adminNav] : baseNav),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] dark:bg-[#16161a] md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-highlight" : "text-muted-foreground hover:text-fg",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
