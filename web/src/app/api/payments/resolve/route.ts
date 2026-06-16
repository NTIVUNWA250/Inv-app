import { NextResponse } from "next/server";
import { paymentsDb } from "@/lib/mock-payments-db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid transaction ID and status (approved/rejected) are required." },
        { status: 400 }
      );
    }

    const index = paymentsDb.findIndex((tx) => tx.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    paymentsDb[index].status = status;

    // BACKEND TODO: When connecting to the Express backend API, transaction approvals
    // will trigger an automated stock increment in Supabase.
    // 
    // The Express backend endpoint (implemented in supabase/api/src/routes/payments.ts)
    // inserts a new record into `stock_movements` with delta = quantity for the
    // selected `location_id`.
    //
    // The database trigger `apply_stock_movement` automatically:
    // 1. Checks if the item already exists at that location.
    // 2. Increments the `quantity` (e.g. from 8 to 9) and `capacity` on `item_stock`
    //    if the payment is approved.
    
    return NextResponse.json({ ok: true, transaction: paymentsDb[index] });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
