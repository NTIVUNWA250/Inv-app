import { Router } from "express"
import { z } from "zod"
import { asyncHandler } from "../http.js"
import { requireAuth, requireAdmin } from "../middleware/auth.js"

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
