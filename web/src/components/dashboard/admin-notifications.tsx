"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, FileText, CheckCircle2, XCircle, AlertCircle, Camera, X, Upload, Check } from "lucide-react";
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

interface CartItem {
    name: string;
    description: string;
    quantity: number;
    price: number;
    image?: string;
}

interface Transaction {
    id: string;
    recipient: string;
    products?: CartItem[];
    productName: string;
    description: string;
    quantity: number;
    price: number;
    status: "pending" | "processing" | "completed" | "failed";
    imageName?: string;
    itemPhoto?: string;
    receiptPhoto?: string;
    createdBy: string;
    createdAt: string;
}

interface AdminNotificationsProps {
    role: "admin" | "member";
    currentUserName: string;
}

export function AdminNotifications({ role, currentUserName }: AdminNotificationsProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [balance, setBalance] = useState<{ availableBalance: string; currency: string } | null>(null);

    // States for inline receipt camera snap (for members)
    const [capturingReceiptTx, setCapturingReceiptTx] = useState<Transaction | null>(null);
    const [receiptPhotoBase64, setReceiptPhotoBase64] = useState<string | null>(null);
    const [receiptCameraStream, setReceiptCameraStream] = useState<MediaStream | null>(null);
    const receiptVideoRef = useRef<HTMLVideoElement | null>(null);

    // Fetch transactions from server and poll every 3 seconds
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await fetch("/api/payments");
                if (res.ok) {
                    const data = await res.json();
                    setTransactions(data);
                }
            } catch (e) {
                console.error("Failed to load transactions for notifications", e);
            }
        };

        fetchTransactions();
        const interval = setInterval(fetchTransactions, 3000);
        return () => clearInterval(interval);
    }, []);

    // Fetch balance from server and poll every 10 seconds
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await fetch("/api/payments/balance");
                if (res.ok) {
                    const data = await res.json();
                    setBalance(data);
                }
            } catch (e) {
                console.error("Failed to load balance for admin notifications", e);
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 10000);
        return () => clearInterval(interval);
    }, []);

    // Start Camera for Receipt snap
    const startReceiptCamera = (tx: Transaction) => {
        setCapturingReceiptTx(tx);
        setReceiptPhotoBase64(null);
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
        }).then((stream) => {
            setReceiptCameraStream(stream);
            setTimeout(() => {
                if (receiptVideoRef.current) {
                    receiptVideoRef.current.srcObject = stream;
                }
            }, 100);
        }).catch((err) => {
            console.error("Camera access error:", err);
            alert("Could not access the camera. Please allow camera permissions.");
            setCapturingReceiptTx(null);
        });
    };

    // Close capture camera stream and reset states
    const closeReceiptCapture = () => {
        if (receiptCameraStream) {
            receiptCameraStream.getTracks().forEach((track) => track.stop());
            setReceiptCameraStream(null);
        }
        setCapturingReceiptTx(null);
        setReceiptPhotoBase64(null);
    };

    // Snap a photo of the receipt
    const handleCaptureReceipt = () => {
        if (receiptVideoRef.current) {
            const video = receiptVideoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                setReceiptPhotoBase64(dataUrl);
                
                // Stop camera stream tracks while previewing
                if (receiptCameraStream) {
                    receiptCameraStream.getTracks().forEach((track) => track.stop());
                }
            }
        }
    };

    // Retake receipt photo
    const handleRetakeReceipt = () => {
        setReceiptPhotoBase64(null);
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
        }).then((stream) => {
            setReceiptCameraStream(stream);
            setTimeout(() => {
                if (receiptVideoRef.current) {
                    receiptVideoRef.current.srcObject = stream;
                }
            }, 100);
        }).catch((err) => {
            console.error("Camera access error on retake:", err);
            alert("Could not reactivate the camera.");
            closeReceiptCapture();
        });
    };

    // Submit Receipt Photo
    const handleSubmitReceipt = async () => {
        if (!capturingReceiptTx || !receiptPhotoBase64) return;

        try {
            const res = await fetch(`/api/payments/transactions/${capturingReceiptTx.id}/receipt`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ receipt_base64: receiptPhotoBase64 }),
            });

            if (res.ok) {
                // Update transaction state locally
                setTransactions((prev) =>
                    prev.map((t) => (t.id === capturingReceiptTx.id ? { ...t, receiptPhoto: receiptPhotoBase64 } : t))
                );
                alert("Receipt photo successfully uploaded!");
            } else {
                alert("Failed to upload receipt photo.");
            }
        } catch {
            alert("Connection error during receipt photo upload.");
        } finally {
            closeReceiptCapture();
        }
    };

    // Clean up camera stream on unmount
    useEffect(() => {
        return () => {
            if (receiptCameraStream) {
                receiptCameraStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [receiptCameraStream]);

    const pendingApproval = role === "admin"
        ? transactions.filter((tx) => tx.status === "pending")
        : [];

    const pendingReceipts = transactions.filter(
        (tx) => tx.status === "completed" && !tx.receiptPhoto && tx.createdBy === currentUserName
    );

    const notificationsCount = pendingApproval.length + pendingReceipts.length;

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
                    prev.map((tx) => (tx.id === txId ? { ...tx, status: status === "approved" ? "completed" : "failed" } : tx))
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
                        {notificationsCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-highlight text-[9px] font-bold text-highlight-foreground">
                                {notificationsCount}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto p-2">
                    <DropdownMenuLabel className="px-2 py-1.5 font-serif text-[13px] text-foreground flex items-center justify-between">
                        <span>Payment Notifications</span>
                        {balance && (
                            <span className="text-[11px] font-mono text-highlight bg-highlight-soft px-2 py-0.5 rounded border border-highlight/15 font-semibold">
                                Bal: {formatRWF(parseFloat(balance.availableBalance))}
                            </span>
                        )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notificationsCount === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 text-success-foreground/30 mb-2" />
                            <p className="text-[12px]">All payment requests resolved</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/20">
                            {/* Render Admin Pending Approvals */}
                            {pendingApproval.map((tx) => (
                                <DropdownMenuItem
                                    key={`approve-${tx.id}`}
                                    onSelect={() => setSelectedTx(tx)}
                                    className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-hover focus:bg-hover"
                                >
                                    <div className="flex w-full items-center justify-between">
                                        <span className="font-semibold text-foreground text-[12px] truncate max-w-[150px]">
                                            Approve: {tx.productName}
                                        </span>
                                        <span className="font-mono text-highlight text-[11px] font-medium">
                                            {formatRWF(tx.price)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate w-full">
                                        To: {tx.recipient} · {tx.products && tx.products.length > 0 ? `${tx.products.length} items` : `Qty: ${tx.quantity}`}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </DropdownMenuItem>
                            ))}

                            {/* Render Member Pending Receipts */}
                            {pendingReceipts.map((tx) => (
                                <DropdownMenuItem
                                    key={`receipt-${tx.id}`}
                                    onSelect={() => startReceiptCamera(tx)}
                                    className="flex flex-col items-start gap-1 p-2.5 cursor-pointer rounded-lg hover:bg-hover focus:bg-hover border-l-2 border-highlight bg-highlight-soft/5"
                                >
                                    <div className="flex w-full items-center justify-between">
                                        <span className="font-semibold text-foreground text-[12px] truncate max-w-[150px]">
                                            Upload Receipt: {tx.productName}
                                        </span>
                                        <span className="font-mono text-highlight text-[11px] font-medium">
                                            {formatRWF(tx.price)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground w-full whitespace-normal leading-normal">
                                        Approved for RWF {formatRWF(tx.price)}. Capture receipt photo to finalize transaction.
                                    </p>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </div>
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

                            {selectedTx.products && selectedTx.products.length > 0 ? (
                                <div className="col-span-3 mt-2 border border-border/60 rounded overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-surface/50 text-muted-foreground font-medium">
                                            <tr>
                                                <th className="p-2">Item</th>
                                                <th className="p-2 text-right">Qty</th>
                                                <th className="p-2 text-right">Unit Price</th>
                                                <th className="p-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {selectedTx.products.map((p, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-2 font-medium text-foreground">
                                                        {p.name}
                                                        {p.description && (
                                                            <div className="text-[10px] text-muted-foreground font-normal">
                                                                {p.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-mono">{p.quantity}</td>
                                                    <td className="p-2 text-right font-mono">{formatRWF(p.price)}</td>
                                                    <td className="p-2 text-right font-mono font-medium text-foreground">{formatRWF(p.price * p.quantity)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}

                            <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3">
                                <span className="text-muted-foreground font-semibold">Total Amount:</span>
                                <span className="col-span-2 text-highlight font-mono font-bold text-[14px]">
                                    {formatRWF(selectedTx.price)}
                                </span>
                            </div>
                            {(() => {
                                const productsWithImages = selectedTx.products?.filter(p => !!p.image) || [];
                                if (productsWithImages.length > 0) {
                                    return (
                                        <div className="border-t border-border/40 pt-3 space-y-2">
                                            <span className="text-muted-foreground font-semibold text-xs block">
                                                Purchased Item Photo{productsWithImages.length > 1 ? "s" : ""}:
                                            </span>
                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border max-w-full">
                                                {productsWithImages.map((p, idx) => (
                                                    <div key={idx} className="flex-none w-[200px] space-y-1.5">
                                                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border bg-black/90">
                                                            <img
                                                                src={p.image}
                                                                alt={p.name}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-semibold text-center truncate px-1">
                                                            {p.name}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                if (selectedTx.imageName) {
                                    return (
                                        <div className="border-t border-border/40 pt-3 space-y-2">
                                            <span className="text-muted-foreground font-semibold text-xs block">Purchased Item Photo:</span>
                                            <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border bg-black/90">
                                                <img
                                                    src={selectedTx.imageName}
                                                    alt="Purchased Item"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
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
            {/* Member Receipt Webcam Capture Modal */}
            <Dialog open={!!capturingReceiptTx} onOpenChange={(open) => !open && closeReceiptCapture()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-serif font-bold text-foreground">
                            Capture Purchase Receipt
                        </DialogTitle>
                        <DialogDescription className="text-[10px] text-muted-foreground">
                            Approved amount: <span className="font-semibold text-highlight font-mono">{capturingReceiptTx && formatRWF(capturingReceiptTx.price)}</span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col gap-4 py-2">
                        {/* Live Video Feed or Captured Preview */}
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-black flex items-center justify-center">
                            {!receiptPhotoBase64 ? (
                                <>
                                    <video
                                        ref={receiptVideoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="border-2 border-dashed border-highlight/40 w-3/4 h-3/4 rounded-md" />
                                    </div>
                                </>
                            ) : (
                                <img
                                    src={receiptPhotoBase64}
                                    alt="Receipt Preview"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            {!receiptPhotoBase64 ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={closeReceiptCapture}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 bg-highlight hover:bg-highlight/90 text-highlight-foreground"
                                        onClick={handleCaptureReceipt}
                                    >
                                        <Camera className="h-4 w-4" /> Capture Photo
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 border-destructive/20 hover:bg-destructive/10 text-destructive"
                                        onClick={handleRetakeReceipt}
                                    >
                                        Retake Photo
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                                        onClick={handleSubmitReceipt}
                                    >
                                        <Check className="h-4 w-4" /> Submit Receipt
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
