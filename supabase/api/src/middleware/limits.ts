import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../http.js";

export async function verifyLimits(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const amount = Number(req.body.amount)
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new HttpError(400, "Invalid transaction amount.", "invalid_amount")
    }

    const { data: profile, error } = await req.supabase.from("profiles").select("role, fallback_role, has_payment_permission, daily_limit, monthly_limit, per_transaction_limit").eq("id", req.user.id).single();
    if (error || !profile) {
      throw new HttpError(403, "Could not load user profile limits", "profile_load_failed");
    }

    const isAdminOrCashier = profile.role === "admin" || profile.fallback_role === "cashier";

    if (!isAdminOrCashier && !profile.has_payment_permission) {
      throw new HttpError(403, "You do not have corporate payment permissions", "no_payment_permission");
    }

    const { daily_limit, monthly_limit, per_transaction_limit } = profile;

    const perTxLimit = Number(per_transaction_limit);
    if (perTxLimit > 0 && amount > perTxLimit) {
      throw new HttpError(422, `Transaction exceeeds your per-transaction limit of RWF ${perTxLimit}.`, "limit_per_transaction_exceeded")
    }

    const dailyLimit = Number(daily_limit)
    if (dailyLimit > 0) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const { data: dailyTx, error: dailyErr } = await req.supabase.from("corporate_transactions").select("amount").eq("user_id", req.user.id).eq("status", "completed").gte("created_at", startOfDay.toISOString())
      if (dailyErr) {
        throw new HttpError(500, "Could not verify daily spending limits.", "limits_check_failed")
      }

      const dailySpent = (dailyTx || []).reduce((sum, tx) => sum + Number(tx.amount), 0)
      if (dailySpent + amount > dailyLimit) {
        throw new HttpError(422, `Transaction exceeds your daily limit. Remaining: RWF ${dailyLimit - dailySpent}`, "limit_daily_exceeded")
      }
    }

    const monthlyLimit = Number(monthly_limit)
    if (monthlyLimit > 0) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: monthlyTx, error: monthlyErr } = await req.supabase.from("corporate_transactions").select("amount").eq("user_id", req.user.id).eq("status", "completed").gte("created_at", startOfMonth.toISOString())
      if (monthlyErr) {
        throw new HttpError(500, "Could not verify monthly spending limits.", "limits_check_failed")
      }

      const monthlySpent = (monthlyTx || []).reduce((sum, tx) => sum + Number(tx.amount), 0)
      if (monthlySpent + amount > monthlyLimit) {
        throw new HttpError(422, `Transaction exceeds your monthly limit. Remaining: RWF ${monthlyLimit - monthlySpent}`, "limit_monthly_exceeded")
      }
    }
    next();
  } catch (err) {
    next(err)
  }
}