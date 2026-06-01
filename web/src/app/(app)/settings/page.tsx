import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { EditProfileForm } from "@/components/dashboard/edit-profile-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/actions";
import type { ApiUser, Profile } from "@/lib/api/types";

export default async function SettingsPage() {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your appearance and account.</p>
      </div>

      <Panel title="Profile">
        <EditProfileForm fullName={profile?.full_name ?? ""} email={user.email ?? ""} />
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="text-sm text-muted">Role</span>
          <span
            className={
              profile?.role === "admin"
                ? "rounded-full bg-pink-500/15 px-2.5 py-0.5 text-xs font-medium text-pink-400"
                : "rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted"
            }
          >
            {profile?.role ?? "member"}
          </span>
        </div>
      </Panel>

      <Panel title="Password">
        <ChangePasswordForm />
      </Panel>

      <Panel title="Appearance">
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-fg">Theme</p>
            <p className="text-sm text-muted">Choose light, dark, or follow your system.</p>
          </div>
          <ThemeToggle />
        </div>
      </Panel>

      <Panel title="Account">
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="text-sm font-medium text-fg">Sign out</p>
            <p className="text-sm text-muted">End your session on this device.</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
