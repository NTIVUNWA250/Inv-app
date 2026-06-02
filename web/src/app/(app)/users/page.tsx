import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { serverApi, ApiError } from "@/lib/api/server";
import { Panel } from "@/components/dashboard/widgets";
import { RoleSelect } from "@/components/dashboard/role-select";
import { AddUserForm } from "@/components/dashboard/add-user-form";
import { DeleteUserButton } from "@/components/dashboard/delete-user-button";
import { BlockUserButton } from "@/components/dashboard/block-user-button";
import { EditUserButton } from "@/components/dashboard/edit-user-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <h1 className="font-serif text-[1.75rem] text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone with an account, and their access level.
        </p>
      </div>

      {loadError ? (
        <Alert variant="warning">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Panel title="Add user">
        <AddUserForm />
      </Panel>

      <Panel
        title="Team members"
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {profiles.length}
          </span>
        }
      >
        {profiles.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Name</TableHead>
                <TableHead className="px-5">Role</TableHead>
                <TableHead className="px-5">Joined</TableHead>
                <TableHead className="px-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="px-5 font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {p.full_name || "—"}
                      {p.blocked ? (
                        <Badge variant="chip" className="bg-warning-soft text-warning">
                          Blocked
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="px-5">
                    <RoleSelect id={p.id} role={p.role} isSelf={p.id === currentUserId} />
                  </TableCell>
                  <TableCell className="px-5 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    {p.id === currentUserId ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <EditUserButton id={p.id} fullName={p.full_name ?? ""} />
                        <BlockUserButton
                          id={p.id}
                          name={p.full_name || "this user"}
                          blocked={p.blocked}
                        />
                        <DeleteUserButton id={p.id} name={p.full_name || "this user"} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
