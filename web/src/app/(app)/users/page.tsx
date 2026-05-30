import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { RoleSelect } from "@/components/dashboard/role-select";
import { AddUserForm } from "@/components/dashboard/add-user-form";
import { DeleteUserButton } from "@/components/dashboard/delete-user-button";
import { BlockUserButton } from "@/components/dashboard/block-user-button";
import type { ApiUser, Profile } from "@/lib/api/types";

export default async function UsersPage() {
  const api = serverApi();

  // Admins only.
  let profile: Profile | null = null;
  let currentUserId = "";
  try {
    const me = await api.get<{ user: ApiUser; profile: Profile | null }>("/auth/me");
    profile = me.profile;
    currentUserId = me.user.id;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }
  if (profile?.role !== "admin") redirect("/");

  let profiles: Profile[] = [];
  let loadError: string | null = null;
  try {
    profiles = await api.get<Profile[]>("/profiles");
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : "Could not load users.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone with an account, and their access level.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {loadError}
        </div>
      ) : null}

      <Panel title="Add user">
        <AddUserForm />
      </Panel>

      <Panel
        title="Team members"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3.5 w-3.5" />
            {profiles.length}
          </span>
        }
      >
        {profiles.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/40">
                    <td className="px-5 py-3 font-medium text-fg">
                      <span className="inline-flex items-center gap-2">
                        {p.full_name || "—"}
                        {p.blocked ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                            Blocked
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <RoleSelect id={p.id} role={p.role} isSelf={p.id === currentUserId} />
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.id === currentUserId ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <BlockUserButton
                            id={p.id}
                            name={p.full_name || "this user"}
                            blocked={p.blocked}
                          />
                          <DeleteUserButton id={p.id} name={p.full_name || "this user"} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
