"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api/server";
import { setSession, clearSession, getAccessToken } from "@/lib/session";
import type { Session, ApiUser } from "@/lib/api/types";

interface AuthResponse {
  user: ApiUser | null;
  session: Session | null;
}

/** Returned to the form via `useActionState`; `error` renders inline. */
export interface AuthFormState {
  error?: string;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let session: Session | null = null;
  try {
    const res = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      },
    });
    session = res.session;
  } catch (err) {
    // Return the error so the form re-renders in place — no redirect, no reload.
    return { error: err instanceof ApiError ? err.message : "Could not sign in." };
  }

  if (!session) {
    return { error: "No session returned." };
  }

  await setSession(session);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let session: Session | null = null;
  try {
    const res = await apiRequest<AuthResponse>("/auth/signup", {
      method: "POST",
      body: {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        full_name: String(formData.get("full_name") ?? ""),
      },
    });
    session = res.session;
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Could not sign up." };
  }

  // If email confirmation is disabled, Supabase returns a session immediately —
  // log the user straight in. Otherwise, send them to log in after confirming.
  if (session) {
    await setSession(session);
    revalidatePath("/", "layout");
    redirect("/");
  }

  redirect("/login?message=Check your email to confirm your account");
}

export async function signOut() {
  const token = await getAccessToken();
  if (token) {
    try {
      await apiRequest("/auth/logout", { method: "POST", token });
    } catch {
      // Best effort — clear local cookies regardless.
    }
  }
  await clearSession();
  redirect("/login");
}
