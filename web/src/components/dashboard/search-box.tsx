"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Debounced global search. Reflects the `?q=` param and, as you type, navigates
 * to the Overview filtered by that query. Clearing it returns to "/".
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    const next = value.trim();
    if (next === current) return; // no change (incl. initial mount) → don't navigate

    const t = setTimeout(() => {
      router.replace(next ? `/?q=${encodeURIComponent(next)}` : "/");
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, router]);

  return (
    <div className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-highlight">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search items, locations…"
        aria-label="Search inventory"
        className="w-full bg-transparent text-fg placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
