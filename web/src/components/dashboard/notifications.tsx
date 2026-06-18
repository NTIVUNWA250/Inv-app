"use client";

import React, { useState, useEffect } from "react";
import { Bell, FileText, CheckCircle2, XCircle, AlertCircle, Info, Trash2 } from "lucide-react";
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
    status: "pending" | "processing" | "completed" | "failed";
    imageName?: string;
    receiptImage?: string;
    createdBy: string;
    createdAt: string;
    locationId?: string;
    locationName?: string;
    failureReason?: string | null;
}

interface StatusNotification {
    id: string;
    txId: string;
    productName: string;
    amount: number;
    status: "completed" | "failed";
    failureReason?: string | null;
    timestamp: number;
    read: boolean;
}

interface NotificationsProps {
    role: "admin" | "member";
    name: string;
}

export function Notifications({ role, name }: NotificationsProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [statusNotifications, setStatusNotifications] = useState<StatusNotification[]>([]);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [isResolving, setIsResolving] = useState<"approved" | "rejected" | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Load and poll transactions
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await fetch("/api/payments");
                if (res.ok) {
                    const data: Transaction[] = await res.json();
                    setTransactions(data);
                    processStatusChanges(data);
                }
            } catch (e) {
                console.error("Failed to load transactions for notifications", e);
            }
        };

        fetchTransactions();
        const interval = setInterval(fetchTransactions, 3000);
        return () => clearInterval(interval);
    }, [name]);

    // Load notifications from local storage on mount
    useEffect(() => {
        const cached = localStorage.getItem(`notifications_history_${name}`);
        if (cached) {
            try {
                setStatusNotifications(JSON.parse(cached));
            } catch (e) {
                console.error("Failed to parse notifications from localStorage", e);
            }
        }
    }, [name]);

    // Save notifications history to local storage when it changes
    const saveNotifications = (newNotifs: StatusNotification[]) => {
        setStatusNotifications(newNotifs);
        localStorage.setItem(`notifications_history_${name}`, JSON.stringify(newNotifs));
    };

    // Helper to detect if a transaction has changed its status to a final state
    const processStatusChanges = (freshTxs: Transaction[]) => {
        const key = `tx_known_statuses_${name}`;
        const knownStatusesStr = localStorage.getItem(key);
        let knownStatuses: Record<string, string> = {};

        if (knownStatusesStr) {
            try {
                knownStatuses = JSON.parse(knownStatusesStr);
            } catch (e) {
                console.error("Failed to parse known statuses", e);
            }
        }

        const newNotifs: StatusNotification[] = [];
        const updatedStatuses = { ...knownStatuses };

        freshTxs.forEach((tx) => {
            const prevStatus = knownStatuses[tx.id];

            // We only care about transactions created by this user
            const isMine = tx.createdBy === name;

            if (isMine && prevStatus && prevStatus !== tx.status) {
                // Status transitioned to a final resolved state
                if (tx.status === "completed" || tx.status === "failed") {
                    newNotifs.push({
                        id: crypto.randomUUID(),
                        txId: tx.id,
                        productName: tx.productName,
                        amount: tx.price * tx.quantity,
                        status: tx.status,
                        failureReason: tx.failureReason,
                        timestamp: Date.now(),
                        read: false,
                    });
                }
            }

            // Update local cache of statuses
            updatedStatuses[tx.id] = tx.status;
        });

        // Save updated status state
        localStorage.setItem(key, JSON.stringify(updatedStatuses));

        if (newNotifs.length > 0) {
            // Load current full list, append new ones at the top, limit to 20
            const currentList = JSON.parse(localStorage.getItem(`notifications_history_${name}`) || "[]");
            const updatedList = [...newNotifs, ...currentList].slice(0, 20);
            saveNotifications(updatedList);
        }
    };

    const formatRWF = (amount: number) => {
        return new Intl.NumberFormat("en-RW", {
            style: "currency",
            currency: "RWF",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handleResolve = async (txId: string, status: "approved" | "rejected") => {
        setIsResolving(status);
        try {
            const res = await fetch("/api/payments/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: txId, status }),
            });

            if (res.ok) {
                const finalStatus = status === "approved" ? "completed" : "failed";
                setTransactions((prev) =>
                    prev.map((tx) => (tx.id === txId ? { ...tx, status: finalStatus } : tx))
                );
                alert(`Payment of ${formatRWF(selectedTx!.price * selectedTx!.quantity)} was successfully resolved!`);
                setSelectedTx(null);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Failed to resolve payment: ${errData.error || "The transaction did not complete."}`);
            }
        } catch (e) {
            console.error("Failed to update transaction status", e);
            alert("Network error: Could not reach the payment server.");
        } finally {
            setIsResolving(null);
        }
    };

    // Mark all employee status notifications as read
    const handleMarkAllRead = () => {
        const updated = statusNotifications.map((n) => ({ ...n, read: true }));
        saveNotifications(updated);
    };

    // Clear employee notification logs
    const handleClearNotifications = (e: React.MouseEvent) => {
        e.stopPropagation();
        saveNotifications([]);
    };

    // Admin: pending requests
    const pendingRequests = role === "admin" ? transactions.filter((tx) => tx.status === "pending") : [];

    // Count unread status changes + pending requests
    const unreadStatusCount = statusNotifications.filter((n) => !n.read).length;
    const badgeCount = pendingRequests.length + unreadStatusCount;

    return (
        <>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <button className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-hover transition-colors outline-none text-muted-foreground hover:text-foreground focus-visible:ring-highlight/25 focus-visible:ring-[3px]">
                        <Bell className="h-5 w-5" />
                        {badgeCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-highlight text-[9px] font-bold text-highlight-foreground">
                                {badgeCount}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto p-2">
                    <div className="flex items-center justify-between px-2 py-1.5">
                        <DropdownMenuLabel className="font-serif text-[13px] text-foreground p-0">
                            Notifications
                        </DropdownMenuLabel>
                        {statusNotifications.length > 0 && (
                            <button
                                onClick={handleClearNotifications}
                                className="text-[10px] text-destructive hover:underline font-semibold flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                    </div>
                    <DropdownMenuSeparator />

                    {/* Render pending requests for Admin */}
                    {role === "admin" && pendingRequests.length > 0 && (
                        <>
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Pending Approvals
                            </div>
                            {pendingRequests.map((tx) => (
                                <DropdownMenuItem
                                    key={tx.id}
                                    onSelect={() => {
                                        setSelectedTx(tx);
                                        setIsOpen(false);
                                    }}
                                    className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-hover focus:bg-hover mb-1 border border-warning/10"
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
                                        By: {tx.createdBy} · To: {tx.recipient}
                                    </p>
                                </DropdownMenuItem>
                            ))}
                            {statusNotifications.length > 0 && <DropdownMenuSeparator />}
                        </>
                    )}

                    {/* Render status transitions for employee */}
                    {statusNotifications.length > 0 ? (
                        <>
                            <div className="flex items-center justify-between px-2 py-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Disbursement Alerts
                                </span>
                                {unreadStatusCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-[10px] text-highlight hover:underline font-semibold"
                                    >
                                        Mark read
                                    </button>
                                )}
                            </div>
                            {statusNotifications.map((notif) => (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg mb-1 transition-colors ${notif.read ? "opacity-75" : "bg-highlight-soft/10 border-l-2 border-highlight"
                                        }`}
                                >
                                    {notif.status === "completed" ? (
                                        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                    )}
                                    <div className="space-y-0.5 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-semibold text-foreground text-[11px] truncate">
                                                {notif.productName}
                                            </span>
                                            <span className="font-mono text-foreground text-[10px] shrink-0 font-medium">
                                                {formatRWF(notif.amount)}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            {notif.status === "completed"
                                                ? "Disbursement request approved and completed."
                                                : `Disbursement failed: ${notif.failureReason || "MOMO_PAYMENT_FAILED"}`}
                                        </p>
                                        <span className="text-[8px] text-muted-foreground block pt-0.5">
                                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </>
                    ) : null}

                    {/* Empty state fallback */}
                    {pendingRequests.length === 0 && statusNotifications.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 text-success-foreground/30 mb-2" />
                            <p className="text-[12px]">All resolved. No new alerts.</p>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Approval Details Modal Pop-up (Admins only) */}
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
                                    <span className="text-muted-foreground font-medium text-[12px]">Product Image:</span>
                                    <div className="relative overflow-hidden rounded-lg border border-border bg-muted/10 max-h-[240px] flex items-center justify-center p-1.5">
                                        <img
                                            src={selectedTx.imageName}
                                            alt="Product Image"
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
                                    <span className="text-muted-foreground font-medium text-[12px]">Product Image:</span>
                                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-center text-muted-foreground bg-muted/5 justify-center">
                                        <FileText className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                                        <span className="text-xs">No product image attached</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto border-destructive/30 hover:bg-destructive/10 text-destructive transition-colors"
                                onClick={() => handleResolve(selectedTx.id, "rejected")}
                                disabled={isResolving !== null}
                            >
                                {isResolving === "rejected" ? "Rejecting..." : "Reject"}
                            </Button>
                            <Button
                                className="w-full sm:w-auto transition-colors"
                                onClick={() => handleResolve(selectedTx.id, "approved")}
                                disabled={isResolving !== null}
                            >
                                {isResolving === "approved" ? "Processing MoMo Pay..." : "Approve Payment"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
