import { NextFunction, Router, type Request, type Response } from "express"
import { z } from "zod"
import { asyncHandler, HttpError } from "../http.js"
import { requireAuth, requireAdmin } from "../middleware/auth.js"
import { verifyLimits } from "../middleware/limits.js"
import { momo } from "../lib/momo.js"

export const paymentsRouter = Router()

// middleware

async function requireAdminOrCashier(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const { data: me, error } = await req.supabase.from("profiles").select("role, fallback_role").eq("id", req.user.id).single()

    if (error || !me) {
      throw new HttpError(403, "Could not verify authorization.", "auth_check_failed")
    }

    if (me.role !== "admin" && me.fallback_role !== "cashier") {
      throw new HttpError(403, "Access restricted to admins and cashiers", "forbidden")
    }

    next()
  } catch (err) {
    next(err)
  }
}

async function requirePaymentAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const { data: me, error } = await req.supabase.from("profiles").select("role, fallback_role, has_payment_permission").eq("id", req.user.id).single()

    if (error || !me) {
      throw new HttpError(403, "Could not verify authorization.", "auth_check_failed")
    }

    const isAdminOrCashier = me.role === "admin" || me.fallback_role === "cashier"
    const hasPermission = me.has_payment_permission === true

    if (!isAdminOrCashier && !hasPermission) {
      throw new HttpError(403, "Access restricted to authorized payment users.", "forbidden")
    }

    next()
  } catch (err) {
    next(err)
  }
}

paymentsRouter.use(requireAuth);
paymentsRouter.use(requirePaymentAccess);

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

  return res.json({ transactionId: tx.id, status: "pending" })
}))

const resolvePaymentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"])
})

paymentsRouter.post("/resolve", requireAdminOrCashier, asyncHandler(async (req, res) => {
  const { id, status } = resolvePaymentSchema.parse(req.body)

  // 1. Fetch transaction and check if it's pending
  const { data: tx, error: txErr } = await req.supabase
    .from("corporate_transactions")
    .select("*, transaction_products(*)")
    .eq("id", id)
    .single()

  if (txErr || !tx) {
    throw new HttpError(404, "Transaction not found", "not_found")
  }

  if (tx.status !== "pending") {
    throw new HttpError(400, "Transaction has already been resolved", "already_resolved")
  }

  if (status === "rejected") {
    // Update status to failed
    await req.supabase.from("corporate_transactions").update({ status: "failed" }).eq("id", id)
    return res.json({ transactionId: id, status: "rejected" })
  }

  // 2. Dispatch MoMo request to pay (USSD push prompt) for approved payment
  try {
    console.log(`[Payments] Dispatching MoMo Request to Pay for Tx: ${tx.id}...`)
    const momoRef = await momo.requestToPay(tx.recipient_phone, tx.amount, tx.id)

    await req.supabase.from("corporate_transactions").update({ status: "processing", momo_ref: momoRef }).eq("id", tx.id)

    console.log(`[Payments] Polling Collection status for Ref: ${momoRef}...`)
    const statusRef = await momo.getCollectionStatus(momoRef)

    if (statusRef.status === "SUCCESSFUL") {
      await req.supabase.from("corporate_transactions").update({ status: "completed" }).eq("id", tx.id)

      // 3. Update stock levels
      const product = tx.transaction_products?.[0]
      if (product) {
        let itemId: string
        const { data: existingItem } = await req.supabase.from("items").select("id").eq("name", product.name).maybeSingle()
        if (existingItem) {
          itemId = existingItem.id
        } else {
          const { data: newItem, error: itemErr } = await req.supabase.from("items").insert({ name: product.name, description: product.description || null }).select("id").single()
          if (itemErr || !newItem) throw itemErr || new Error("Failed to seed new item")
          itemId = newItem.id
        }

        const { error: moveErr } = await req.supabase.from("stock_movements").insert({
          item_id: itemId,
          location_id: tx.location_id,
          user_id: req.user.id,
          delta: product.quantity,
          capacity_delta: product.quantity,
          reason: "initial",
          note: `Auto-purchased via corporate transaction ${tx.id}`,
        })

        if (moveErr) throw moveErr
        console.log(`[Payments] Stock updated successfully for Item: ${product.name}.`)
      }

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

const listQuerySchema = z.object({ limit: z.coerce.number().int().positive().max(200).default(50), offset: z.coerce.number().int().nonnegative().default(0), })

paymentsRouter.get("/transactions", asyncHandler(async (req, res) => {
  const { limit, offset } = listQuerySchema.parse(req.query)
  const { data: me } = await req.supabase.from("profiles").select("role, fallback_role").eq("id", req.user.id).single()

  const isAdminOrCashier = me?.role === "admin" || me?.fallback_role === "cashier"

  let query = req.supabase.from("corporate_transactions").select(`*, profiles:user_id(full_name, role, fallback_role), transaction_products(*), locations:location_id(name)`).order("created_at", { ascending: false }).range(offset, offset + limit - 1)

  if (!isAdminOrCashier) {
    query = query.eq("user_id", req.user.id)
  }

  const { data, error } = await query
  if (error) throw error
  res.json(data)
}))

paymentsRouter.get("/reports/export", requireAdminOrCashier, asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase.from("corporate_transactions").select(`id, created_at, amount, recipient_phone, status, profiles:user_id(full_name) ,transaction_products(name, quantity, price)`).order("created_at", { ascending: false })
  if (error) throw error

  let csv = "Transaction ID, Employee, Recipient Phone, Product Name, Quantity, Price, Total Amount, Status, Date\n"
  for (const tx of data || []) {
    const employee = (tx.profiles as any)?.full_name || "Unknown"
    const product = tx.transaction_products?.[0]?.name || "N/A"
    const qty = tx.transaction_products?.[0]?.quantity || 0
    const price = tx.transaction_products?.[0]?.price || 0
    const date = new Date(tx.created_at).toISOString()
    csv += `"${tx.id}", "${employee.replace(/"/g, '""')}", "${tx.recipient_phone}", "${product.replace(/"/g, '""')}",${qty}, ${price}, ${tx.amount}, "${tx.status}","${date}"\n`
  }

  res.setHeader("Content-Type", "text/csv")
  res.setHeader("Content-Disposition", "attachment;filename=corporate_expense_report.csv")
  res.send(csv)
})
)

paymentsRouter.get("/notifications", asyncHandler(async (req, res) => {
  const { data: me } = await req.supabase.from("profiles").select("role, fallback_role").eq("id", req.user.id).single()

  const isAdminOrCashier = me?.role === "admin" || me?.fallback_role === "cashier"

  let query = req.supabase.from("corporate_transactions").select(`id,status,amount,recipient_phone, created_at, profiles:user_id(full_name), transaction_products(name)`).order("created_at", { ascending: false }).limit(20)

  if (!isAdminOrCashier) {
    query = query.eq("user_id", req.user.id)
  }
  const { data, error } = await query
  if (error) throw error

  const notifications = (data || []).map((tx) => {
    const productName = tx.transaction_products?.[0]?.name || "Product"
    const employeeName = (tx.profiles as any)?.full_name || "An employee"
    let message = ""

    if (tx.status === "completed") {
      message = isAdminOrCashier ? `${employeeName} paid RWF ${tx.amount} to ${tx.recipient_phone} for ${productName}.` : `Your payment of RWF ${tx.amount} for ${productName} succeeded.`
    } else if (tx.status === "failed") {
      message = isAdminOrCashier ? `Payment request by ${employeeName} for ${tx.amount} failed.` : `Your payment of RWF ${tx.amount} for ${productName} failed`
    } else {
      message = isAdminOrCashier ? `New pending payment request from ${employeeName} for RWF ${tx.amount}.` : `Your payment of RWF ${tx.amount} for ${productName} is processing.`
    }

    return {
      id: tx.id,
      type: tx.status,
      message,
      timestamp: tx.created_at,
    }
  })
  res.json(notifications)
}))