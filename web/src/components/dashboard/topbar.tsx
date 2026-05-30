import { Search } from "lucide-react";

interface TopbarProps {
  name: string;
  role: "member" | "admin";
}

export function Topbar({ name, role }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <span className="text-sm font-medium text-zinc-300 md:hidden">Inventory</span>

      <div className="hidden flex-1 items-center sm:flex">
        <div className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-500">
          <Search className="h-4 w-4" />
          <span>Search items, locations…</span>
          <kbd className="ml-auto rounded border border-zinc-700 px-1.5 text-xs text-zinc-500">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {role === "admin" ? (
          <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-xs font-medium text-pink-400">
            Admin
          </span>
        ) : null}
        <span className="hidden text-sm text-zinc-400 sm:inline">{name}</span>
      </div>
    </header>
  );
}
