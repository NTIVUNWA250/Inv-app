import { NextResponse } from "next/server";
import { paymentsDb } from "@/lib/mock-payments-db";

export async function GET() {
  return NextResponse.json(paymentsDb);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (
      !body.recipient ||
      !body.productName ||
      !body.price ||
      !body.createdBy ||
      !body.locationId ||
      !body.locationName
    ) {
      return NextResponse.json(
        {
          error:
            "Recipient, product name, price, location, and createdBy are required.",
        },
        { status: 400 }
      );
    }

    const priceNum = parseFloat(body.price);
    const qtyNum = parseInt(body.quantity) || 1;

    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: "Price must be a valid positive number." },
        { status: 400 }
      );
    }

    const newTx = {
      id: Math.random().toString(36).substring(2, 9),
      recipient: String(body.recipient).trim(),
      productName: String(body.productName).trim(),
      description: String(body.description || "").trim(),
      quantity: qtyNum,
      price: priceNum,
      status: "pending" as const,
      imageName: body.imageName || undefined,
      createdBy: String(body.createdBy).trim(),
      createdAt: new Date().toISOString(),
      locationId: String(body.locationId).trim(),
      locationName: String(body.locationName).trim(),
    };

    paymentsDb.unshift(newTx);
    return NextResponse.json({ ok: true, transaction: newTx });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
