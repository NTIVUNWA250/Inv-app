import React from "react";
import { serverApi, ApiError } from "@/lib/api/server";
import { redirect } from "next/navigation";
import { PaymentsClient } from "@/components/dashboard/payments-client";
import type { ApiUser, Profile, Location, Item, StockLevel } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const api = serverApi();
  let userName = "User";
  let userRole: "admin" | "member" = "member";
  let locations: Location[] = [];
  let items: Item[] = [];
  let stock: StockLevel[] = [];

  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    userName = me.profile?.full_name || me.user.email || "User";
    userRole = me.profile?.role || "member";
    
    [locations, items, stock] = await Promise.all([
      api.get<Location[]>("/locations"),
      api.get<Item[]>("/items?limit=200"),
      api.get<StockLevel[]>("/stock"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/login");
    }
    console.error("Failed to retrieve data for payments page:", err);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-serif text-[1.75rem] text-foreground">
          Payments & Expenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Initiate corporate mobile money (MoMo) payments and track request history.
        </p>
      </div>

      <PaymentsClient
        currentUserName={userName}
        role={userRole}
        locations={locations}
        items={items}
        stock={stock}
      />
    </div>
  );
}


