import { Suspense } from "react";
import { SearchBox } from "./search-box";

interface TopbarProps {
  name: string;
  role: "member" | "admin";
}

export function Topbar({ name, role }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-canvas/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <span className="text-sm font-medium text-muted md:hidden">Inventory</span>

      <div className="hidden flex-1 items-center sm:flex">
        <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-lg border border-line bg-surface" />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {role === "admin" ? (
          <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-xs font-medium text-pink-400">
            Admin
          </span>
        ) : null}
        <span className="hidden text-sm text-muted sm:inline">{name}</span>
      </div>
    </header>
  );
}
