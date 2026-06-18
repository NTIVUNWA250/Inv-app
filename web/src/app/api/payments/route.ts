import { NextResponse } from "next/server";
import { serverApi, ApiError } from "@/lib/api/server";

interface BackendProduct {
  name: string;
  description?: string | null;
  quantity: number;
  price: number;
  item_photo_base64?: string | null;
}

interface BackendTransaction {
  id: string;
  user_id: string;
  recipient_phone: string;
  amount: number;
  status: string;
  momo_ref?: string | null;
  item_photo_base64?: string | null;
  receipt_base64?: string | null;
  location_id: string;
  created_at: string;
  profiles?: {
    full_name?: string | null;
  } | null;
  locations?: {
    name?: string | null;
  } | null;
  transaction_products?: BackendProduct[] | null;
}

interface RequestBody {
  recipient?: string;
  locationId?: string;
  locationName?: string;
  createdBy?: string;
  imageName?: string | null;
  products?: (BackendProduct & { image?: string | null })[];
}

export async function GET() {
  try {
    const api = serverApi();
    const backendTxs = await api.get<BackendTransaction[]>("/payments/transactions?limit=100");

    const mappedTxs = backendTxs.map((tx) => {
      const products = (tx.transaction_products || []).map((p) => ({
        name: p.name,
        description: p.description || "",
        quantity: p.quantity,
        price: p.price,
        image: p.item_photo_base64 || undefined
      }));

      return {
        id: tx.id,
        recipient: tx.recipient_phone,
        products: products,
        productName: products.map((p) => p.name).join(", ") || "N/A",
        description: products[0]?.description || "",
        quantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
        price: tx.amount, // Total amount is directly stored in the transaction
        status: tx.status,
        imageName: tx.item_photo_base64 || undefined,
        itemPhoto: tx.item_photo_base64 || undefined,
        receiptPhoto: tx.receipt_base64 || undefined,
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
    const body = (await request.json()) as RequestBody;

    if (
      !body.recipient ||
      !body.locationId ||
      !body.createdBy ||
      !Array.isArray(body.products) ||
      body.products.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Recipient, storage location, createdBy, and a non-empty products list are required.",
        },
        { status: 400 }
      );
    }

    const api = serverApi();

    const backendRes = await api.post<{ transactionId: string; status: string }>("/payments/request", {
      recipient_phone: String(body.recipient).trim(),
      location_id: String(body.locationId).trim(),
      products: body.products.map((p) => ({
        name: String(p.name).trim(),
        description: p.description ? String(p.description).trim() : null,
        quantity: parseInt(String(p.quantity)) || 1,
        price: parseFloat(String(p.price)) || 0,
        image_base64: p.image || null
      })),
      receipt_base64: body.imageName || null
    });

    const totalQty = body.products.reduce((sum, p) => sum + (parseInt(String(p.quantity)) || 1), 0);
    const totalAmount = body.products.reduce((sum, p) => sum + ((parseFloat(String(p.price)) || 0) * (parseInt(String(p.quantity)) || 1)), 0);

    const mappedTx = {
      id: backendRes.transactionId,
      recipient: String(body.recipient).trim(),
      products: body.products,
      productName: body.products.map((p) => p.name).join(", "),
      description: body.products[0]?.description || "",
      quantity: totalQty,
      price: totalAmount,
      status: backendRes.status,
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
