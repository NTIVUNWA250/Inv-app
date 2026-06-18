"use client";

import React, { useState, useEffect } from "react";
import { Wallet, Camera, CheckCircle2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/dashboard/widgets";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Location, Item, StockLevel } from "@/lib/api/types";

interface Transaction {
  id: string;
  recipient: string;
  productName: string;
  description: string;
  quantity: number;
  price: number;
  status: "pending" | "processing" | "completed" | "failed";
  imageName?: string;
  createdBy: string;
  createdAt: string;
  locationId?: string;
  locationName?: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

interface PaymentsClientProps {
  currentUserName: string;
  role: "admin" | "member";
  locations: Location[];
  items: Item[];
  stock: StockLevel[];
}



export function PaymentsClient({
  currentUserName,
  role,
  locations,
  items,
  stock,
}: PaymentsClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"request" | "audit">("request");

  // Budget management states
  const [budget, setBudget] = useState<{
    allocated_amount: number;
    remaining_amount: number;
    month: number;
    year: number;
  } | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [newAllocation, setNewAllocation] = useState("0");

  const fetchBudget = async () => {
    try {
      const res = await fetch("/api/payments/budget");
      if (res.ok) {
        const data = await res.json();
        setBudget(data);
        setNewAllocation(String(data.allocated_amount));
      }
    } catch (error) {
      console.log("Failed to load monthly budget info", error);
    }
  };

  const handleSaveBudget = async () => {
    setIsSavingBudget(true);
    try {
      const res = await fetch("/api/payments/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocated_amount: parseFloat(newAllocation) || 0
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBudget(data);
        setIsEditingBudget(false);
      } else {
        alert("Failed to update allocated budget");
      }
    } catch (error) {
      console.error(error);
      alert("Error saving budget");
    } finally {
      setIsSavingBudget(false);
    }
  };

  const percentUsed = budget && budget.allocated_amount > 0 ? ((budget.allocated_amount - budget.remaining_amount) / budget.allocated_amount) * 100 : 0;
  const [form, setForm] = useState({
    recipient: "",
    productName: "",
    description: "",
    quantity: 1,
    price: "",
    locationId: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const startCamera = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      setStatusMsg({
        type: "error",
        text: "Could not access the camera. Please allow camera permissions.",
      });
    }
  };

  const stopCamera = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const capturedFile = new File([blob], "receipt_capture.jpg", {
                type: "image/jpeg",
              });
              setFile(capturedFile);
              stopCamera();
            }
          },
          "image/jpeg",
          0.9
        );
      }
    }
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Fetch transactions and poll every 3 seconds for real-time updates across browsers/profiles
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch("/api/payments");
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error("Failed to load transactions", e);
      }
    };
    fetchTransactions();
    if (role === "admin") {
      fetchBudget();
    }
    const interval = setInterval(() => {
      fetchTransactions();
      if (role === "admin") {
        fetchBudget();
      }
    }, 3000);
    return () => {
      clearInterval(interval);
    };
  }, [role]);

  // Render a beautifully styled status badge
  const renderStatusBadge = (status: Transaction["status"]) => {
    const styles = {
      pending: "bg-warning-soft text-amber-700 dark:text-warning border-warning/30",
      processing: "bg-info-soft text-sky-700 dark:text-info border-info/30 animate-pulse",
      completed: "bg-success-soft text-emerald-700 dark:text-success border-success/30",
      failed: "bg-destructive-soft text-red-700 dark:text-destructive border-destructive/30",
    };

    const dotStyles = {
      pending: "bg-amber-600 dark:bg-warning",
      processing: "bg-sky-600 dark:bg-info",
      completed: "bg-emerald-600 dark:bg-success",
      failed: "bg-red-600 dark:bg-destructive",
    };

    const labels = {
      pending: "Pending Approval",
      processing: "MoMo Processing",
      completed: "Completed",
      failed: "Failed",
    };

    const label = labels[status] || status;
    const style = styles[status] || "bg-muted text-muted-foreground border-muted/20";
    const dotStyle = dotStyles[status] || "bg-muted-foreground";

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all ${style}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
        {label}
      </span>
    );
  };

  // Format RWF currency
  const formatRWF = (amount: number) => {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "quantity" ? parseInt(value) || 0 : value,
    }));
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const selectedItem = items.find((item) => item.name === selectedName);

    if (selectedItem) {
      // Find where this item is currently stocked
      const itemStock = stock.filter((s) => s.item_id === selectedItem.id);
      // Sort to find the location with the highest stock level
      const preferredStock = itemStock.sort((a, b) => b.quantity - a.quantity)[0];
      // Default to the first location if no stock level is found
      const targetLocationId = preferredStock ? preferredStock.location_id : (locations[0]?.id || "");

      setForm((prev) => ({
        ...prev,
        productName: selectedItem.name,
        description: selectedItem.description || "",
        locationId: targetLocationId,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.recipient.trim() ||
      !form.productName.trim() ||
      !form.price ||
      !form.locationId
    ) {
      setStatusMsg({
        type: "error",
        text: "Please fill out all required fields.",
      });
      return;
    }

    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setStatusMsg({
        type: "error",
        text: "Please enter a valid price greater than 0.",
      });
      return;
    }

    if (form.quantity <= 0) {
      setStatusMsg({
        type: "error",
        text: "Quantity must be at least 1.",
      });
      return;
    }

    const selectedLoc = locations.find((l) => l.id === form.locationId);
    const locationName = selectedLoc ? selectedLoc.name : "Default";

    let base64Image: string | undefined = undefined;
    if (file) {
      try {
        base64Image = await fileToBase64(file);
      } catch (err) {
        console.error("Failed to convert image to base64:", err);
      }
    }

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: form.recipient.trim(),
          productName: form.productName.trim(),
          description: form.description.trim(),
          quantity: form.quantity,
          price: priceNum,
          // MOCK/SANDBOX STORAGE: Send the Base64 Data URL to simulate image upload.
          // FOR PRODUCTION REAL BACKEND: Upload to Supabase/S3 first, then send the public URL instead.
          imageName: base64Image || undefined,
          createdBy: currentUserName,
          locationId: form.locationId,
          locationName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransactions((prev) => [data.transaction, ...prev]);

        // Reset Form
        setForm({
          recipient: "",
          productName: "",
          description: "",
          quantity: 1,
          price: "",
          locationId: "",
        });
        setFile(null);
        setStatusMsg({
          type: "success",
          text: "Payment request submitted successfully via MTN MoMo!",
        });

        // Clear success message after 5 seconds
        setTimeout(() => {
          setStatusMsg((current) =>
            current?.type === "success" ? null : current
          );
        }, 5000);
      } else {
        const errData = await res.json();
        setStatusMsg({
          type: "error",
          text: errData.error || "Failed to submit request.",
        });
      }
    } catch (e) {
      console.error(e);
      setStatusMsg({
        type: "error",
        text: "Could not connect to the mock API server.",
      });
    }
  };

  const handleExport = () => {
    window.location.href = "/api/payments/reports/export";
  };

  const myTransactions = transactions.filter((tx) => tx.createdBy === currentUserName);

  return (
    <div className="space-y-6">
      {role === "admin" && (
        <div className="flex border-b border-border space-x-6 mb-2">
          <button
            onClick={() => setActiveTab("request")}
            className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 outline-none ${activeTab === "request"
              ? "border-highlight text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Request Expense
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 outline-none ${activeTab === "audit"
              ? "border-highlight text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Auditing & Reports
          </button>
        </div>
      )}

      {activeTab === "request" ? (
        <div className="grid gap-6 md:grid-cols-1">
          <Panel title="Request MoMo Payment">
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {statusMsg && (
                <Alert variant={statusMsg.type === "success" ? "success" : "error"} dismissible>
                  <AlertDescription>{statusMsg.text}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Phone Number / Code</Label>
                  <Input
                    id="recipient"
                    name="recipient"
                    required
                    placeholder="e.g. +250 788 123 456 or MoMo Pay Merchant Code"
                    value={form.recipient}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <select
                    id="productName"
                    name="productName"
                    required
                    value={form.productName}
                    onChange={handleProductChange}
                    className="flex h-10 w-full rounded-md border border-input bg-card/60 bg-opacity-70 dark:bg-card/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-highlight disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled className="bg-background">
                      Select a registered product...
                    </option>
                    {items.map((item) => (
                      <option key={item.id} value={item.name} className="bg-background text-foreground">
                        {item.name} {item.sku ? `(${item.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="description">Product Description</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="e.g. Standard notebooks, printing papers, and pens for the team"
                    value={form.description}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationId">Target Storage Location</Label>
                  <select
                    id="locationId"
                    name="locationId"
                    required
                    value={form.locationId}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-card/60 bg-opacity-70 dark:bg-card/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-highlight disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled className="bg-background">
                      Select a location...
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id} className="bg-background text-foreground">
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    required
                    value={form.quantity}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price (RWF)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min={1}
                    required
                    placeholder="e.g. 15000"
                    value={form.price}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Receipt / Product Image (Camera Capture)</Label>

                {/* Camera Active View */}
                {isCameraActive && (
                  <div className="relative overflow-hidden rounded-lg border border-input bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-[320px] object-cover"
                    />
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                      <Button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-success text-success-foreground hover:bg-success/90 shadow-lg"
                      >
                        <Camera className="h-4 w-4" />
                        Capture Photo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={stopCamera}
                        className="shadow-lg"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Camera Inactive & No Photo Taken */}
                {!isCameraActive && !file && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full flex flex-col items-center justify-center rounded-lg border border-dashed border-input bg-surface/30 px-6 py-8 transition-colors hover:border-highlight/40 cursor-pointer"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-[13px] font-medium text-foreground">
                      Open Camera & Take Photo
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      Webcam or mobile camera access required
                    </span>
                  </button>
                )}

                {/* Photo Captured Preview */}
                {!isCameraActive && file && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface/20 p-4 space-y-3">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Captured receipt preview"
                      className="max-h-[200px] rounded-md object-contain border border-line shadow-sm"
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono font-medium">
                        receipt_capture.jpg (Captured)
                      </span>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="inline-flex h-7 px-2.5 items-center gap-1.5 rounded-md bg-destructive-soft text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Retake Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit">
                  <Wallet className="h-4 w-4" />
                  Submit Payment Request
                </Button>
              </div>
            </form>
          </Panel>

          <Panel
            title="My Submitted Requests"
            action={
              <span className="text-xs text-muted-foreground">
                {myTransactions.length} {myTransactions.length === 1 ? "payment" : "payments"}
              </span>
            }
          >
            {myTransactions.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                No payment requests submitted by you yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-5">Recipient Phone / Code</TableHead>
                    <TableHead className="px-5">Product Name</TableHead>
                    <TableHead className="px-5">Location</TableHead>
                    <TableHead className="px-5 text-right">Quantity</TableHead>
                    <TableHead className="px-5 text-right">Price</TableHead>
                    <TableHead className="px-5 text-right">Status</TableHead>
                    <TableHead className="px-5 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="px-5 font-medium text-foreground">
                        {tx.recipient}
                      </TableCell>
                      <TableCell className="px-5 text-muted-foreground">
                        {tx.productName}
                      </TableCell>
                      <TableCell className="px-5 text-muted-foreground">
                        {tx.locationName || "—"}
                      </TableCell>
                      <TableCell className="px-5 text-right font-mono tabular-nums text-foreground">
                        {tx.quantity}
                      </TableCell>
                      <TableCell className="px-5 text-right font-mono tabular-nums text-foreground font-semibold">
                        {formatRWF(tx.price)}
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        {renderStatusBadge(tx.status)}
                      </TableCell>
                      <TableCell className="px-5 text-right font-mono text-[11px] text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
      ) : (
        <div className="space-y-6">
          {role === "admin" && (
            <Panel title="Monthly Budget Allocation">
              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-serif text-base text-foreground font-medium">
                      Active Budget ({budget ? `${budget.month}/${budget.year}` : "Current Month"})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Track and limit total corporate spending disbursements for this month.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingBudget ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={newAllocation}
                          onChange={(e) => setNewAllocation(e.target.value)}
                          className="w-36 rounded-md border border-border bg-card px-3 py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Allocation (RWF)"
                        />
                        <button
                          onClick={handleSaveBudget}
                          disabled={isSavingBudget}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {isSavingBudget ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingBudget(false);
                            setNewAllocation(budget ? String(budget.allocated_amount) : "0");
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingBudget(true)}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Set Allocation
                      </button>
                    )}
                  </div>
                </div>

                {budget && budget.allocated_amount > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block font-medium">Allocated Limit</span>
                        <span className="font-mono text-base font-semibold text-foreground">
                          {formatRWF(budget.allocated_amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground block font-medium">Remaining Balance</span>
                        <span className="font-mono text-base font-semibold text-highlight">
                          {formatRWF(budget.remaining_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Gauge */}
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-border">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentUsed > 85
                            ? "bg-destructive"
                            : percentUsed > 60
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                        style={{ width: `${Math.min(100, percentUsed)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                      <span>{percentUsed.toFixed(0)}% utilized</span>
                      <span>{formatRWF(budget.allocated_amount - budget.remaining_amount)} spent</span>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Export Expense Reports">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-serif text-base text-foreground font-medium">Download CSV Auditing Ledger</h3>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Generate and download a comprehensive CSV report containing all recorded corporate transactions, descriptions, amounts, and statuses for auditing and bookkeeping.
                </p>
              </div>
              <Button onClick={handleExport} className="shrink-0 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV Report
              </Button>
            </div>
          </Panel>

          <Panel
            title="All Corporate Transactions Audit Log"
            action={
              <span className="text-xs text-muted-foreground">
                {transactions.length} {transactions.length === 1 ? "payment" : "payments"}
              </span>
            }
          >
            {transactions.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                No corporate transactions found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-5">Date</TableHead>
                    <TableHead className="px-5">Employee</TableHead>
                    <TableHead className="px-5">Recipient Phone / Code</TableHead>
                    <TableHead className="px-5">Product Name</TableHead>
                    <TableHead className="px-5">Location</TableHead>
                    <TableHead className="px-5 text-right">Quantity</TableHead>
                    <TableHead className="px-5 text-right">Total Amount</TableHead>
                    <TableHead className="px-5 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="px-5 font-mono text-[11px] text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-5 text-muted-foreground font-medium">
                        {tx.createdBy}
                      </TableCell>
                      <TableCell className="px-5 font-medium text-foreground">
                        {tx.recipient}
                      </TableCell>
                      <TableCell className="px-5 text-muted-foreground font-semibold">
                        {tx.productName}
                      </TableCell>
                      <TableCell className="px-5 text-muted-foreground">
                        {tx.locationName || "—"}
                      </TableCell>
                      <TableCell className="px-5 text-right font-mono tabular-nums text-foreground">
                        {tx.quantity}
                      </TableCell>
                      <TableCell className="px-5 text-right font-mono tabular-nums text-highlight font-bold">
                        {formatRWF(tx.price * tx.quantity)}
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        {renderStatusBadge(tx.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
