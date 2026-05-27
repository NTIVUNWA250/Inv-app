import { Package } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-slate-50">
            <Package className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
