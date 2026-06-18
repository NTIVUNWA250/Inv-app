import { NextResponse } from "next/server";
import { serverApi, ApiError } from "@/lib/api/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, receipt_base64 } = body;

    if (!id || !receipt_base64) {
      return NextResponse.json(
        { error: "Transaction ID and receipt image data are required." },
        { status: 400 }
      );
    }

    const api = serverApi();

    // Proxies payload to the Express backend
    const backendRes = await api.post<{ ok: boolean; message: string }>(
      `/payments/transactions/${id}/receipt`,
      { receipt_base64 }
    );

    return NextResponse.json(backendRes);
  } catch (error) {
    console.error("POST /api/payments/receipt failed:", error);
    const status = error instanceof ApiError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status });
  }
}
