import { NextResponse } from "next/server";
import { serverApi, ApiError } from "@/lib/api/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const api = serverApi();
    const item = await api.post("/items", {
      name: body.name,
      sku: body.sku || null,
      description: body.description || null,
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("POST /api/items failed:", error);
    const status = error instanceof ApiError ? error.status : 500;
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status });
  }
}
