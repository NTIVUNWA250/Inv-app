import { Package } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-600 text-white">
            <Package className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-fg">Inventory</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
