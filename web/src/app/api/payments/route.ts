import { NextResponse } from "next/server";
import { serverApi, ApiError } from "@/lib/api/server";

export async function GET() {
  try {
    const api = serverApi();
    const backendTxs = await api.get<any[]>("/payments/transactions?limit=100");

    const mappedTxs = backendTxs.map((tx) => {
      const product = tx.transaction_products?.[0] || {};

      let status: "pending" | "approved" | "rejected" = "pending";
      if (tx.status === "completed") {
        status = "approved";
      } else if (tx.status === "failed") {
        status = "rejected";
      }

      return {
        id: tx.id,
        recipient: tx.recipient_phone,
        productName: product.name || "N/A",
        description: product.description || "",
        quantity: product.quantity || 0,
        price: product.price || 0,
        status,
        imageName: undefined,
        createdBy: tx.profiles?.full_name || "Unknown",
        createdAt: tx.created_at,
        locationId: tx.location_id,
        locationName: tx.locations?.name || "",
      };
    });

    return NextResponse.json(mappedTxs);
  } catch (error) {
    console.error("GET /api/payments failed:", error);
    const status = error instanceof ApiError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      !body.recipient ||
      !body.productName ||
      !body.price ||
      !body.createdBy ||
      !body.locationId
    ) {
      return NextResponse.json(
        {
          error:
            "Recipient, product name, price, and location are required.",
        },
        { status: 400 }
      );
    }

    const priceNum = parseFloat(body.price);
    const qtyNum = parseInt(body.quantity) || 1;
    const amount = priceNum * qtyNum;

    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: "Price must be a valid positive number." },
        { status: 400 }
      );
    }

    const api = serverApi();

    const backendRes = await api.post<any>("/payments/request", {
      recipient_phone: String(body.recipient).trim(),
      amount,
      location_id: String(body.locationId).trim(),
      product: {
        name: String(body.productName).trim(),
        description: String(body.description || "").trim(),
        quantity: qtyNum,
        price: priceNum
      },
      receipt_base64: null
    });

    const mappedTx = {
      id: backendRes.transactionId,
      recipient: String(body.recipient).trim(),
      productName: String(body.productName).trim(),
      description: String(body.description || "").trim(),
      quantity: qtyNum,
      price: priceNum,
      status: backendRes.status === "completed" ? ("approved" as const) : backendRes.status === "failed" ? ("rejected" as const) : ("pending" as const),
      createdBy: String(body.createdBy).trim(),
      createdAt: new Date().toISOString(),
      locationId: String(body.locationId).trim(),
      locationName: String(body.locationName || "").trim(),
    };

    return NextResponse.json({ ok: true, transaction: mappedTx });
  } catch (error) {
    console.error("POST /api/payments failed:", error);
    const status = error instanceof ApiError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status });
  }
}
