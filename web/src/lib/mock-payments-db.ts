export interface Transaction {
  id: string;
  recipient: string;
  productName: string;
  description: string;
  quantity: number;
  price: number;
  status: "pending" | "approved" | "rejected";
  imageName?: string;
  createdBy: string;
  createdAt: string;
  locationId?: string;
  locationName?: string;
}

// Persist database across hot reloads in Next.js development mode
const globalForPayments = global as unknown as {
  paymentsDb: Transaction[];
};

export const paymentsDb = globalForPayments.paymentsDb || [];

if (process.env.NODE_ENV !== "production") {
  globalForPayments.paymentsDb = paymentsDb;
}
