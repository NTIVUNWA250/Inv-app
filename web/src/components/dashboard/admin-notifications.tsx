"use client";

import React, { useState, useEffect } from "react";
import { Bell, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Transaction {
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
}

export function AdminNotifications() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Fetch transactions from server and poll every 3 seconds to support multi-profile real-time updates
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.warn("Failed to load transactions for notifications", e);
      }
    };

    fetchTransactions();

    const interval = setInterval(fetchTransactions, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const pending = transactions.filter((tx) => tx.status === "pending");

  const formatRWF = (amount: number) => {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleResolve = async (txId: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch("/api/payments/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: txId,
          status,
        }),
      });

      if (res.ok) {
        // Optimistically update local state immediately
        setTransactions((prev) =>
          prev.map((tx) => (tx.id === txId ? { ...tx, status } : tx))
        );
      } else {
        console.error("Failed to resolve payment on server");
      }
    } catch (e) {
      console.error("Failed to update transaction status", e);
    }
    setSelectedTx(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-hover transition-colors outline-none text-muted-foreground hover:text-foreground focus-visible:ring-highlight/25 focus-visible:ring-[3px]">
            <Bell className="h-5 w-5" />
            {pending.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-highlight text-[9px] font-bold text-highlight-foreground">
                {pending.length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto p-2">
          <DropdownMenuLabel className="px-2 py-1.5 font-serif text-[13px] text-foreground">
            Payment Notifications
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-success-foreground/30 mb-2" />
              <p className="text-[12px]">All payment requests resolved</p>
            </div>
          ) : (
            pending.map((tx) => (
              <DropdownMenuItem
                key={tx.id}
                onSelect={() => setSelectedTx(tx)}
                className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-hover focus:bg-hover"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-foreground text-[12px]">
                    {tx.productName}
                  </span>
                  <span className="font-mono text-highlight text-[11px] font-medium">
                    {formatRWF(tx.price * tx.quantity)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate w-full">
                  To: {tx.recipient} · Qty: {tx.quantity}
                </p>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Approval Details Modal Pop-up */}
      {selectedTx && (
        <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-highlight-soft text-highlight">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-semibold font-serif">
                  Review Payment Request
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                A pending payment request has been submitted. Review details and approve disbursement.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3.5 border-y border-border py-4 text-[13px]">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Requested By:</span>
                <span className="col-span-2 text-foreground font-semibold">
                  {selectedTx.createdBy}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Recipient:</span>
                <span className="col-span-2 text-foreground break-all select-all font-mono">
                  {selectedTx.recipient}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Product Name:</span>
                <span className="col-span-2 text-foreground font-semibold">
                  {selectedTx.productName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Description:</span>
                <span className="col-span-2 text-foreground">
                  {selectedTx.description || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Quantity:</span>
                <span className="col-span-2 text-foreground font-mono">
                  {selectedTx.quantity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground font-medium">Price (RWF):</span>
                <span className="col-span-2 text-foreground font-mono">
                  {formatRWF(selectedTx.price)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                <span className="text-muted-foreground font-medium font-semibold">Total Amount:</span>
                <span className="col-span-2 text-highlight font-mono font-bold text-[14px]">
                  {formatRWF(selectedTx.price * selectedTx.quantity)}
                </span>
              </div>
              {selectedTx.imageName && (
                selectedTx.imageName.startsWith("data:image/") ||
                selectedTx.imageName.startsWith("http://") ||
                selectedTx.imageName.startsWith("https://")
              ) ? (
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <span className="text-muted-foreground font-medium text-[12px]">Receipt Attachment:</span>
                  <div className="relative overflow-hidden rounded-lg border border-border bg-muted/10 max-h-[240px] flex items-center justify-center p-1.5">
                    <img
                      src={selectedTx.imageName}
                      alt="Receipt Attachment"
                      className="max-h-[228px] w-full object-contain rounded-md transition-transform hover:scale-[1.02] duration-200"
                    />
                  </div>
                </div>
              ) : selectedTx.imageName ? (
                <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                  <span className="text-muted-foreground font-medium">Attachment:</span>
                  <span className="col-span-2 text-foreground flex items-center gap-1.5 font-medium truncate">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate text-[12px]">{selectedTx.imageName}</span>
                  </span>
                </div>
              ) : (
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <span className="text-muted-foreground font-medium text-[12px]">Receipt Attachment:</span>
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-center text-muted-foreground bg-muted/5 justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    <span className="text-xs">No receipt image attached</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-destructive/30 hover:bg-destructive/10 text-destructive transition-colors"
                onClick={() => handleResolve(selectedTx.id, "rejected")}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                className="w-full sm:w-auto transition-colors"
                onClick={() => handleResolve(selectedTx.id, "approved")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
