import React from "react";
import { serverApi, ApiError } from "@/lib/api/server";
import { redirect } from "next/navigation";
import { PaymentsClient } from "@/components/dashboard/payments-client";
import type { ApiUser, Profile, Location, Item, StockLevel } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const api = serverApi();
  let userName = "User";
  let locations: Location[] = [];
  let items: Item[] = [];
  let stock: StockLevel[] = [];

  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    userName = me.profile?.full_name || me.user.email || "User";
    
    // Fetch locations, catalog items, and stock in parallel
    const [fetchedLocations, fetchedItems, fetchedStock] = await Promise.all([
      api.get<Location[]>("/locations"),
      api.get<Item[]>("/items"),
      api.get<StockLevel[]>("/stock"),
    ]);
    locations = fetchedLocations;
    items = fetchedItems;
    stock = fetchedStock;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/login");
    }
    console.error("Failed to retrieve payments data:", err);
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
        locations={locations} 
        items={items} 
        stock={stock}
      />
    </div>
  );
}
