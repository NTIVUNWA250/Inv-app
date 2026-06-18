import { NextResponse } from "next/server";
import { serverApi, ApiError } from "@/lib/api/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.receipt_base64) {
      return NextResponse.json(
        { error: "Receipt image payload (receipt_base64) is required." },
        { status: 400 }
      );
    }

    const api = serverApi();
    const updatedTx = await api.patch<unknown>(`/payments/transactions/${id}/receipt`, {
      receipt_base64: body.receipt_base64,
    });

    return NextResponse.json(updatedTx);
  } catch (error) {
    console.error("PATCH /api/payments/transactions/[id]/receipt failed:", error);
    const status = error instanceof ApiError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status });
  }
}
