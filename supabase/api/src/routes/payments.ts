import { Router } from "express"
import { z } from "zod"
import { asyncHandler } from "../http.js"
import { requireAuth, requireAdmin } from "../middleware/auth.js"
import { verifyLimits } from "../middleware/limits.js"
import { momo } from "../lib/momo.js"
import { optional, string } from "zod/v4"

export const paymentsRouter = Router()

paymentsRouter.use(requireAuth);

const paymentSettingsBody = z.object({
  has_payment_permission: z.boolean().optional(),
  fallback_role: z.enum(["cashier", "none"]).optional(),
  daily_limit: z.coerce.number().nonnegative().optional(),
  monthly_limit: z.coerce.number().nonnegative().optional(),
  per_transaction_limit: z.coerce.number().nonnegative().optional(),
})

paymentsRouter.patch("/profiles/:id/payment-settings", requireAdmin, asyncHandler(async (req, res) => {
  const body = paymentSettingsBody.parse(req.body);

  const { data, error } = await req.supabase.from("profiles").update(body).eq("id", req.params.id).select().single();

  if (error) throw error;
  res.json(data)
}))

const paymentRequestSchema = z.object({
  recipient_phone: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  location_id: z.string().uuid(),
  product: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    quantity: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative()
  }),
  receipt_base64: z.string().trim().nullable().optional()
})

paymentsRouter.post("/request", verifyLimits, asyncHandler(async (req, res) => {
  const body = paymentRequestSchema.parse(req.body)

  const { data: tx, error: txErr } = await req.supabase.from("corporate_transactions").insert({
    user_id: req.user.id,
    recipient_phone: body.recipient_phone,
    amount: body.amount,
    status: "pending",
    receipt_base64: body.receipt_base64 || null,
    location_id: body.location_id,
  }).select("id").single()

  if (txErr || !tx) throw txErr || new Error("Failed to record transaction")

  const { error: prodErr } = await req.supabase.from("transaction_products").insert({
    transaction_id: tx.id,
    name: body.product.name,
    description: body.product.description || null,
    quantity: body.product.quantity,
    price: body.product.price,
  })

  if (prodErr) throw prodErr

  try {
    console.log(`[Payments] Dispatching MoMo transfer for Tx: ${tx.id}...`)
    const momoRef = await momo.transfer(body.recipient_phone, body.amount, tx.id)

    await req.supabase.from("corporate_transactions").update({ status: "processing", momo_ref: momoRef }).eq("id", tx.id)

    console.log(`[Payments] Polling MoMo status for Ref: ${momoRef}...`)
    const statusRef = await momo.getTransferStatus(momoRef)

    if (statusRef.status === "SUCCESSFUL") {
      await req.supabase.from("corporate_transactions").update({ status: "completed" }).eq("id", tx.id)

      let itemId: string
      const { data: existingItem } = await req.supabase.from("items").select("id").eq("name", body.product.name).maybeSingle()
      if (existingItem) {
        itemId = existingItem.id
      } else {
        const { data: newItem, error: itemErr } = await req.supabase.from("items").insert({ name: body.product.name, description: body.product.description || null }).select("id").single()
        if (itemErr || !newItem) throw itemErr || new Error("Failed to seed new item")
        itemId = newItem.id
      }

      const { error: moveErr } = await req.supabase.from("stock_movements").insert({
        item_id: itemId,
        location_id: body.location_id,
        user_id: req.user.id,
        delta: body.product.quantity,
        note: `Auto-purchased via corporate transaction ${tx.id}`,
      })

      if (moveErr) throw moveErr
      console.log(`[Payments] Stock updated successfully for Item: ${body.product.name}.`)
      return res.json({ transactionId: tx.id, status: "completed" })
    } else {
      await req.supabase.from("corporate_transactions").update({ status: "failed" }).eq("id", tx.id)
      return res.status(422).json({ transactionId: tx.id, status: "failed", error: statusRef.reason?.message || "Transfer failed" })

    }
  } catch (err) {
    await req.supabase.from("corporate_transactions").update({ status: "failed" }).eq("id", tx.id)
    throw err
  }
}))
