import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PostgrestError } from "@supabase/supabase-js";
import { ZodError } from "zod";

/** An error with an attached HTTP status code. */
export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

/** Wraps an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Translate a PostgREST error into an HttpError with a sensible status.
 * RLS denials surface as code 42501 (insufficient privilege) or as an empty
 * result; we map the common ones so clients get 403/404/409 instead of 500.
 */
export function fromPostgrest(error: PostgrestError): HttpError {
  switch (error.code) {
    case "42501": // insufficient_privilege (RLS denied the write)
      return new HttpError(403, "You don't have permission to do that.", error.code);
    case "23505": // unique_violation
      return new HttpError(409, error.message, error.code);
    case "23503": // foreign_key_violation
      return new HttpError(409, error.message, error.code);
    case "23514": // check_violation (e.g. quantity went negative)
      return new HttpError(422, error.message, error.code);
    case "PGRST116": // no rows returned for a single() that required one
      return new HttpError(404, "Not found.", error.code);
    default:
      return new HttpError(400, error.message, error.code ?? undefined);
  }
}

/** Express error-handling middleware. Must keep all four arguments. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { message: "Invalid request body.", code: "validation_error", details: err.flatten() },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code } });
    return;
  }

  // PostgrestError shape (duck-typed — it isn't an Error subclass).
  if (err && typeof err === "object" && "code" in err && "message" in err && "details" in err) {
    const httpErr = fromPostgrest(err as PostgrestError);
    res.status(httpErr.status).json({ error: { message: httpErr.message, code: httpErr.code } });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: { message: "Internal server error.", code: "internal_error" } });
}
