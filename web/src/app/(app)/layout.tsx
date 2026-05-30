import { redirect } from "next/navigation";
import { serverApi, ApiError } from "@/lib/api/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import type { ApiUser, Profile } from "@/lib/api/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const api = serverApi();

  let user: ApiUser;
  let profile: Profile | null = null;
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    user = me.user;
    profile = me.profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const role = profile?.role ?? "member";
  const name = profile?.full_name || user.email || "User";
  const email = user.email ?? "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar role={role} name={name} email={email} />
      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar name={name} role={role} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
