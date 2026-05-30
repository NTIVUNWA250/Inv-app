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

export async function login(formData: FormData) {
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
    const message = err instanceof ApiError ? err.message : "Could not sign in.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  if (!session) {
    redirect(`/login?error=${encodeURIComponent("No session returned.")}`);
  }

  await setSession(session);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
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
    const message = err instanceof ApiError ? err.message : "Could not sign up.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
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
