import { Suspense } from "react";
import { SearchBox } from "./search-box";
import { ScanButton } from "./scan-button";
import { UserMenu } from "./user-menu";
import { AdminNotifications } from "./admin-notifications";
import { VerletLogo } from "@/components/ui/verlet-logo";
import { Badge } from "@/components/ui/badge";

interface TopbarProps {
  name: string;
  email: string;
  role: "member" | "admin";
}

export function Topbar({ name, email, role }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground md:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
          <VerletLogo className="h-4 w-4" />
        </span>
        Inventory
      </span>

      <div className="hidden flex-1 items-center sm:flex">
        <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-lg border border-line bg-card" />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ScanButton />
        {role === "admin" ? (
          <>
            <AdminNotifications />
            <Badge variant="chip" className="bg-highlight-soft text-highlight">
              Admin
            </Badge>
          </>
        ) : null}
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
