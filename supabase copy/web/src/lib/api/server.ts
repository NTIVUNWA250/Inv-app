import "server-only";
import { getAccessToken } from "@/lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Json = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: string;
  body?: Json;
  token?: string | null;
}

/** Low-level call to the inventory-api. Throws ApiError on non-2xx. */
export async function apiRequest<T = unknown>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code);
  }
  return data as T;
}

/**
 * An API client bound to the current request's session cookie. Use from server
 * components, server actions, and route handlers. Token refresh is handled in
 * proxy.ts before the request reaches these.
 */
export function serverApi() {
  const withToken = async <T>(path: string, opts: RequestOptions = {}) =>
    apiRequest<T>(path, { ...opts, token: await getAccessToken() });

  return {
    get: <T>(path: string) => withToken<T>(path),
    post: <T>(path: string, body?: Json) => withToken<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body?: Json) => withToken<T>(path, { method: "PATCH", body }),
    del: <T>(path: string) => withToken<T>(path, { method: "DELETE" }),
  };
}
