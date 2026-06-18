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

function calculateTotalAmount(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && Array.isArray(req.body.products)) {
    const total = req.body.products.reduce((sum: number, p: any) => {
      const price = Number(p.price) || 0;
      const qty = Number(p.quantity) || 0;
      return sum + (price * qty);
    }, 0);
    req.body.amount = total;
  }
  next();
}

const paymentRequestSchema = z.object({
  recipient_phone: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  location_id: z.string().uuid(),
  products: z.array(
    z.object({
      name: z.string().trim().min(1),
      description: z.string().trim().nullable().optional(),
      quantity: z.coerce.number().int().positive(),
      price: z.coerce.number().nonnegative(),
      image_base64: z.string().trim().nullable().optional()
    })
  ).nonempty(),
  receipt_base64: z.string().trim().nullable().optional()
})

paymentsRouter.post("/request", calculateTotalAmount, verifyLimits, asyncHandler(async (req, res) => {
  const body = paymentRequestSchema.parse(req.body)

  // Call the atomic transaction RPC function
  const { data: txId, error: txErr } = await req.supabase.rpc("create_corporate_transaction", {
    p_user_id: req.user.id,
    p_recipient_phone: body.recipient_phone,
    p_amount: body.amount,
    p_location_id: body.location_id,
    p_receipt_base64: body.receipt_base64 || null,
    p_products: body.products,
  })

  if (txErr || !txId) throw txErr || new Error("Failed to record transaction")

  return res.json({ transactionId: txId, status: "pending" })
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
    await req.supabase.from("corporate_transactions").update({ status: "failed", failure_reason: "Rejected by Administrator" }).eq("id", id)
    return res.json({ transactionId: id, status: "rejected" })
  }

  // 2. Handle approval & verify monthly budget
  const txDate = new Date(tx.created_at)
  const year = txDate.getFullYear()
  const month = txDate.getMonth() + 1

  const { data: budget, error: budgetErr } = await req.supabase
    .from("monthly_budgets")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle()

  if (budgetErr) throw budgetErr
  if (!budget || Number(budget.remaining_amount) < Number(tx.amount)) {
    const reason = !budget ? "NO_BUDGET_ALLOCATED" : "INSUFFICIENT_MONTHLY_BUDGET"

    await req.supabase.from("corporate_transactions").update({
      status: "failed",
      failure_reason: reason
    }).eq("id", id)

    throw new HttpError(400, !budget ? "No budget allocated for this month." : "Insufficient monthly budget balance", "insufficient_budget")
  }

  // Deduction of funds immediately (Hold / Reserve state)
  const reservedRemaining = Number(budget.remaining_amount) - Number(tx.amount)
  await req.supabase.from("monthly_budgets").update({ remaining_amount: reservedRemaining }).eq("id", budget.id)

  // Linking the budget reference to this transaction record
  await req.supabase.from("corporate_transactions").update({ budget_id: budget.id }).eq("id", tx.id)

  // 3. Dispatch MoMo disbursement (USSD push prompt / transfer)
  try {
    console.log(`[Payments] Dispatching MoMo disbursement for Tx: ${tx.id}...`)
    const momoRef = await momo.transfer(tx.recipient_phone, tx.amount, tx.id)

    await req.supabase.from("corporate_transactions").update({ status: "processing", momo_ref: momoRef }).eq("id", tx.id)

    console.log(`[Payments] Polling MoMo status for Ref: ${momoRef}...`)
    const statusRef = await momo.getTransferStatus(momoRef)

    if (statusRef.status === "SUCCESSFUL") {
      await req.supabase.from("corporate_transactions").update({ status: "completed" }).eq("id", tx.id)

      // 4. Update stock levels for all products in the cart (strictly gated on payment success)
      const products = tx.transaction_products || []
      for (const product of products) {
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
          user_id: tx.user_id,
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
      // Rollback budget
      const { data: currentBudget } = await req.supabase.from("monthly_budgets").select("remaining_amount").eq("id", budget.id).single()
      const refundedRemaining = Number(currentBudget?.remaining_amount || 0) + Number(tx.amount)
      await req.supabase.from("monthly_budgets").update({
        remaining_amount: refundedRemaining
      }).eq("id", budget.id)

      // Store MoMo failure reason code (e.g. INSUFFICIENT_FUNDS, TIMEOUT, etc.)
      const failureReason = statusRef.reason?.code || "MOMO_PAYMENT_FAILED"

      await req.supabase.from("corporate_transactions").update({
        status: "failed",
        failure_reason: failureReason
      }).eq("id", tx.id)

      return res.status(400).json({ error: "MoMo Checkout payment was unsuccessful", code: "momo_payment_failed", reason: failureReason })
    }
  } catch (momoErr: any) {
    console.error("[Payments] Resolution failed:", momoErr)

    // Rollback budget
    const { data: currentBudget } = await req.supabase.from("monthly_budgets").select("remaining_amount").eq("id", budget.id).single()
    const refundedRemaining = Number(currentBudget?.remaining_amount || 0) + Number(tx.amount)

    await req.supabase.from("monthly_budgets").update({ remaining_amount: refundedRemaining }).eq("id", budget.id)

    const failureReason = momoErr.message || "GATEWAY_DISPATCH_ERROR"
    await req.supabase.from("corporate_transactions").update({
      status: "failed",
      failure_reason: failureReason
    }).eq("id", tx.id)

    throw momoErr
  }
}))

// 4. GET /balance endpoint (admin only)
paymentsRouter.get("/balance", requireAdmin, asyncHandler(async (_req, res) => {
  const balance = await momo.getAccountBalance()
  res.json(balance)
}))

// 5. PATCH /transactions/:id/receipt endpoint (upload receipt post-approval)
const receiptBodySchema = z.object({
  receipt_base64: z.string().trim().min(1),
})

paymentsRouter.patch("/transactions/:id/receipt", asyncHandler(async (req, res) => {
  const { receipt_base64 } = receiptBodySchema.parse(req.body)

  const { data, error } = await req.supabase
    .from("corporate_transactions")
    .update({ receipt_base64 })
    .eq("id", req.params.id)
    .select()
    .single()

  if (error) throw error
  res.json(data)
}))

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().uuid().optional(),
})

paymentsRouter.get("/transactions", asyncHandler(async (req, res) => {
  const { limit, offset, userId } = listQuerySchema.parse(req.query)
  const { data: me } = await req.supabase.from("profiles").select("role, fallback_role").eq("id", req.user.id).single()

  const isAdminOrCashier = me?.role === "admin" || me?.fallback_role === "cashier"

  if (!isAdminOrCashier && userId && userId !== req.user.id) {
    throw new HttpError(403, "You do not have permission to view another user's transactions.", "forbidden")
  }

  let query = req.supabase.from("corporate_transactions").select(`*, profiles:user_id(full_name, role, fallback_role), transaction_products(*), locations:location_id(name)`).order("created_at", { ascending: false }).range(offset, offset + limit - 1)

  if (!isAdminOrCashier) {
    query = query.eq("user_id", req.user.id)
  } else if (userId) {
    query = query.eq("user_id", userId)
  }

  const { data, error } = await query
  if (error) throw error

  // Query stock movements to see which transactions have been stocked
  const { data: movements, error: moveErr } = await req.supabase
    .from("stock_movements")
    .select("note")
    .like("note", "Auto-purchased via corporate transaction %")

  if (moveErr) throw moveErr

  const stockedTxIds = new Set<string>()
  if (movements) {
    movements.forEach((m) => {
      const match = m.note?.match(/Auto-purchased via corporate transaction ([a-f0-9-]{36})/)
      if (match && match[1]) {
        stockedTxIds.add(match[1])
      }
    })
  }

  const mapped = (data || []).map((tx) => ({
    ...tx,
    is_stocked: stockedTxIds.has(tx.id)
  }))

  res.json(mapped)
}))

const budgetSchema = z.object({
  allocated_amount: z.number().nonnegative()
})

paymentsRouter.get("/budgets", requireAdminOrCashier, asyncHandler(async (req, res) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: budget, error } = await req.supabase.from("monthly_budgets").select("*").eq("year", year).eq("month", month).maybeSingle()

  if (error) throw error

  res.json(budget || { allocated_amount: 0, remaining_amount: 0, year, month })
}))

paymentsRouter.post("/budgets", requireAdminOrCashier, asyncHandler(async (req, res) => {
  const { allocated_amount } = budgetSchema.parse(req.body)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: existing, error: getErr } = await req.supabase.from("monthly_budgets").select("*").eq("year", year).eq("month", month).maybeSingle()

  if (getErr) throw getErr

  let result

  if (existing) {
    const difference = allocated_amount - Number(existing.allocated_amount)
    const newRemaining = Number(existing.remaining_amount) + difference

    const { data, error } = await req.supabase.from("monthly_budgets").update({
      allocated_amount: Number(allocated_amount),
      remaining_amount: Math.max(0, newRemaining),
      updated_at: new Date().toISOString()
    }).eq("id", existing.id).select("*").single()

    if (error) throw error

    result = data
  } else {
    const { data, error } = await req.supabase.from("monthly_budgets").insert({
      year,
      month,
      allocated_amount,
      remaining_amount: allocated_amount
    }).select().single()

    if (error) throw error

    result = data
  }

  res.json(result)
}))

paymentsRouter.get("/reports/export", requireAdminOrCashier, asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase.from("corporate_transactions").select(`id, created_at, amount, recipient_phone, status, profiles:user_id(full_name) ,transaction_products(name, quantity, price)`).order("created_at", { ascending: false })
  if (error) throw error

  // Query exporting admin's profile name
  const { data: me } = await req.supabase.from("profiles").select("full_name").eq("id", req.user.id).single()
  const adminName = me?.full_name || "System Administrator"

  const totalCount = data?.length || 0
  const completedCount = (data || []).filter(tx => tx.status === "completed").length
  const pendingCount = (data || []).filter(tx => tx.status === "pending").length
  const processingCount = (data || []).filter(tx => tx.status === "processing").length
  const failedCount = (data || []).filter(tx => tx.status === "failed").length

  const totalDisbursed = (data || [])
    .filter(tx => tx.status === "completed")
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)

  let csv = `"VERLET ROBOTICS - CORPORATE EXPENSE AUDIT LEDGER"\n`
  csv += `"Generated On:","${new Date().toISOString()}"\n`
  csv += `"Exported By:","${adminName.replace(/"/g, '""')}"\n`
  csv += `"Summary Stats:",\n`
  csv += `,"Total Transactions:",${totalCount}\n`
  csv += `,"Completed / Disbursed Payments:",${completedCount}\n`
  csv += `,"Total Funds Disbursed:",${totalDisbursed},"RWF"\n`
  csv += `,"Status Breakdown:","Completed: ${completedCount} | Pending: ${pendingCount} | Processing: ${processingCount} | Failed: ${failedCount}"\n`
  csv += `\n`
  csv += `"Transaction ID","Employee","Recipient Phone / Code","Product Name","Quantity","Unit Price (RWF)","Total Amount (RWF)","Status","Date Created"\n`

  for (const tx of data || []) {
    const employee = (tx.profiles as any)?.full_name || "Unknown"
    const date = new Date(tx.created_at).toISOString()
    const products = tx.transaction_products || []
    
    if (products.length === 0) {
      csv += `"${tx.id}","${employee.replace(/"/g, '""')}","${tx.recipient_phone}","N/A",0,0,${tx.amount},"${tx.status}","${date}"\n`
    } else {
      for (const product of products) {
        csv += `"${tx.id}","${employee.replace(/"/g, '""')}","${tx.recipient_phone}","${product.name.replace(/"/g, '""')}",${product.quantity},${product.price},${product.price * product.quantity},"${tx.status}","${date}"\n`
      }
    }
  }

  res.setHeader("Content-Type", "text/csv")
  res.setHeader("Content-Disposition", "attachment;filename=corporate_expense_report.csv")
  res.send(csv)
})
)

paymentsRouter.get("/notifications", asyncHandler(async (req, res) => {
  const { data: me } = await req.supabase.from("profiles").select("role, fallback_role").eq("id", req.user.id).single()

  const isAdminOrCashier = me?.role === "admin" || me?.fallback_role === "cashier"

  let query = req.supabase.from("corporate_transactions").select(`id,status,amount,recipient_phone, failure_reason, created_at, item_photo_base64, receipt_base64, profiles:user_id(full_name), transaction_products(name)`).order("created_at", { ascending: false }).limit(20)

  if (!isAdminOrCashier) {
    query = query.eq("user_id", req.user.id)
  }
  const { data, error } = await query
  if (error) throw error

  const notifications = (data || []).map((tx) => {
    const productName = tx.transaction_products?.[0]?.name || "Product"
    const employeeName = (tx.profiles as any)?.full_name || "An employee"
    let message = ""
    const reasonSuffix = tx.failure_reason ? ` (Reason: ${tx.failure_reason})` : ""

    if (tx.status === "completed") {
      message = isAdminOrCashier ? `${employeeName} paid RWF ${tx.amount} to ${tx.recipient_phone} for ${productName}.` : `Your payment of RWF ${tx.amount} for ${productName} succeeded.`
    } else if (tx.status === "failed") {
      message = isAdminOrCashier ? `Payment request by ${employeeName} for RWF ${tx.amount} failed${reasonSuffix}.` : `Your payment of RWF ${tx.amount} for ${productName} failed${reasonSuffix}.`
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