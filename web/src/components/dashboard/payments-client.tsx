"use client";

import React, { useState, useEffect } from "react";
import { Wallet, Camera, CheckCircle2, Trash2 } from "lucide-react";
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
  status: "pending" | "approved" | "rejected";
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
  locations: Location[];
  items: Item[];
  stock: StockLevel[];
}

export function PaymentsClient({
  currentUserName,
  locations,
  items,
  stock,
}: PaymentsClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
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
        console.warn("Failed to load transactions", e);
      }
    };

    fetchTransactions();

    const interval = setInterval(fetchTransactions, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

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

  const handleItemSelectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    setSelectedItemId(selectedVal);

    if (selectedVal === "") {
      setForm((prev) => ({
        ...prev,
        productName: "",
        description: "",
      }));
    } else {
      const selectedItem = items.find((item) => item.id === selectedVal);
      if (selectedItem) {
        // Find where this item is currently stocked
        const itemStock = (stock || []).filter((s) => s.item_id === selectedItem.id);
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
        setSelectedItemId("");
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

  // Render a beautifully styled status badge
  const renderStatusBadge = (status: Transaction["status"]) => {
    const styles = {
      pending: "bg-warning-soft text-warning border-warning/10",
      approved: "bg-success-soft text-success border-success/10",
      rejected: "bg-destructive-soft text-destructive border-destructive/10",
    };

    const labels = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Declined",
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
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
                <Label htmlFor="itemSelector">Product Name</Label>
                <select
                  id="itemSelector"
                  name="itemSelector"
                  required
                  value={selectedItemId}
                  onChange={handleItemSelectorChange}
                  className="flex h-10 w-full rounded-md border border-input bg-card/60 bg-opacity-70 dark:bg-card/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-highlight disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" className="bg-background">
                    Select a registered product...
                  </option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id} className="bg-background text-foreground">
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
                  readOnly={selectedItemId !== ""}
                  className={selectedItemId !== "" ? "bg-muted cursor-not-allowed opacity-80" : ""}
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
          title="Transaction History"
          action={
            <span className="text-xs text-muted-foreground">
              {transactions.length} {transactions.length === 1 ? "payment" : "payments"}
            </span>
          }
        >
          {transactions.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              No transactions submitted yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-5">Recipient Phone / Code</TableHead>
                  <TableHead className="px-5">Product Name</TableHead>
                  <TableHead className="px-5">Product Description</TableHead>
                  <TableHead className="px-5">Requested By</TableHead>
                  <TableHead className="px-5">Location</TableHead>
                  <TableHead className="px-5 text-right">Quantity</TableHead>
                  <TableHead className="px-5 text-right">Price</TableHead>
                  <TableHead className="px-5 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="px-5 font-medium text-foreground">
                      {tx.recipient}
                    </TableCell>
                    <TableCell className="px-5 text-muted-foreground">
                      {tx.productName}
                    </TableCell>
                    <TableCell className="px-5 text-muted-foreground">
                      {tx.description || "—"}
                    </TableCell>
                    <TableCell className="px-5 text-muted-foreground font-medium">
                      {tx.createdBy}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
