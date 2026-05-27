import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "./(auth)/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
            <p className="text-sm text-slate-500">
              Signed in as {user.email}
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </header>

        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-medium text-slate-900">
            Stock dashboard coming soon
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Next: item catalog, stock counts per location, check-out / check-in.
          </p>
        </section>
      </div>
    </main>
  );
}
