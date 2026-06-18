"use client";

import React, { useState, useEffect, useRef } from "react";
import { Wallet, Camera, Plus, X, Upload, FileText, Check, AlertTriangle } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import type { Location } from "@/lib/api/types";

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
    locationId?: string;
    locationName?: string;
}

interface PaymentsClientProps {
    currentUserName: string;
    role: "admin" | "member";
    locations: Location[];
    items: unknown[];
    stock: unknown[];
    catalogItems: { id?: string; name: string; description?: string | null; [key: string]: unknown }[];
}

export function PaymentsClient({ currentUserName, role, locations, catalogItems }: PaymentsClientProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeTab, setActiveTab] = useState<"request" | "reports" | "history">("request");
    
    // Form and Cart states
    const [cart, setCart] = useState<CartItem[]>([]);
    const [form, setForm] = useState({
        recipient: "",
        productName: "",
        description: "",
        quantity: 1,
        price: "",
        locationId: "",
    });
    
    const [localCatalog, setLocalCatalog] = useState<{ id?: string; name: string; description?: string | null; [key: string]: unknown }[]>(catalogItems || []);
    const [statusMsg, setStatusMsg] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    // Post-approval webcam capture states
    const [capturingTx, setCapturingTx] = useState<Transaction | null>(null);
    const [itemPhotoBase64, setItemPhotoBase64] = useState<string | null>(null);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Form webcam capture states (Upfront purchase item verification)
    const [currentItemPhoto, setCurrentItemPhoto] = useState<string | null>(null);
    const [formCameraStream, setFormCameraStream] = useState<MediaStream | null>(null);
    const formVideoRef = useRef<HTMLVideoElement | null>(null);

    // Zoomable Image viewer states (Admin)
    const [viewingPhotoBase64, setViewingPhotoBase64] = useState<string | null>(null);
    const [viewingPhotoTx, setViewingPhotoTx] = useState<Transaction | null>(null);
    const [zoomScale, setZoomScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Check if the currently entered product exists in catalog
    const typedNameTrimmed = form.productName.trim().toLowerCase();
    const catalogMatch = typedNameTrimmed
        ? localCatalog.find(c => c.name.toLowerCase() === typedNameTrimmed)
        : null;
    const itemExistsInCatalog = !!catalogMatch;

    // Start Live Webcam Stream for Post-Approval snap
    const startCaptureCamera = async (tx: Transaction) => {
        setCapturingTx(tx);
        setItemPhotoBase64(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            setCameraStream(stream);
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
            setCapturingTx(null);
        }
    };

    // Close capture camera stream and reset states
    const closeCaptureModal = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            setCameraStream(null);
        }
        setCapturingTx(null);
        setItemPhotoBase64(null);
    };

    // Snap a photo from the live video stream
    const handleCapturePhoto = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                setItemPhotoBase64(dataUrl);
                // Stop camera stream tracks while previewing
                if (cameraStream) {
                    cameraStream.getTracks().forEach((track) => track.stop());
                }
            }
        }
    };

    // Retake photo: reactivates live video stream
    const handleRetake = async () => {
        setItemPhotoBase64(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            setCameraStream(stream);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("Camera access error on retake:", err);
            setStatusMsg({
                type: "error",
                text: "Could not reactivate the camera.",
            });
            closeCaptureModal();
        }
    };

    // Submit Captured Photo of the purchased item
    const handleSubmitItemPhoto = async () => {
        if (!capturingTx || !itemPhotoBase64) return;

        try {
            const res = await fetch(`/api/payments/transactions/${capturingTx.id}/receipt`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ receipt_base64: itemPhotoBase64 }),
            });

            if (res.ok) {
                // Update transaction state locally
                setTransactions((prev) =>
                    prev.map((t) => (t.id === capturingTx.id ? { ...t, receiptPhoto: itemPhotoBase64 } : t))
                );
                setStatusMsg({
                    type: "success",
                    text: "Receipt photo successfully uploaded and verified!",
                });
            } else {
                setStatusMsg({
                    type: "error",
                    text: "Failed to upload purchased item photo.",
                });
            }
        } catch {
            setStatusMsg({
                type: "error",
                text: "Connection error during purchased item photo upload.",
            });
        } finally {
            closeCaptureModal();
        }
    };

    // Clean up camera streams on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((track) => track.stop());
            }
            if (formCameraStream) {
                formCameraStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [cameraStream, formCameraStream]);

    // Start inline form camera
    const startFormCamera = async () => {
        setCurrentItemPhoto(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            setFormCameraStream(stream);
            setTimeout(() => {
                if (formVideoRef.current) {
                    formVideoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("Form camera access error:", err);
            setStatusMsg({
                type: "error",
                text: "Could not access the camera. Please allow camera permissions.",
            });
        }
    };

    // Stop inline form camera
    const stopFormCamera = () => {
        if (formCameraStream) {
            formCameraStream.getTracks().forEach((track) => track.stop());
            setFormCameraStream(null);
        }
    };

    // Capture inline form photo
    const handleCaptureFormPhoto = () => {
        if (formVideoRef.current) {
            const video = formVideoRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                setCurrentItemPhoto(dataUrl);
                
                // Stop camera stream tracks after capture
                if (formCameraStream) {
                    formCameraStream.getTracks().forEach((track) => track.stop());
                    setFormCameraStream(null);
                }
            }
        }
    };

    // Retake inline form photo
    const handleRetakeFormPhoto = () => {
        setCurrentItemPhoto(null);
        startFormCamera();
    };

    // Fetch transactions and poll every 3 seconds for updates
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
        const interval = setInterval(fetchTransactions, 3000);
        return () => clearInterval(interval);
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

    // Add product to the cart state
    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        
        if (!form.recipient.trim()) {
            setStatusMsg({ type: "error", text: "Recipient phone number is required before adding items." });
            return;
        }
        if (!form.locationId) {
            setStatusMsg({ type: "error", text: "Target storage location is required before adding items." });
            return;
        }
        if (!form.productName.trim()) {
            setStatusMsg({ type: "error", text: "Product name is required." });
            return;
        }
        const priceNum = parseFloat(form.price);
        if (isNaN(priceNum) || priceNum <= 0) {
            setStatusMsg({ type: "error", text: "Please enter a valid price greater than 0." });
            return;
        }
        if (form.quantity <= 0) {
            setStatusMsg({ type: "error", text: "Quantity must be at least 1." });
            return;
        }
        if (!currentItemPhoto) {
            setStatusMsg({ type: "error", text: "Please capture a photo of the item you are buying." });
            return;
        }

        const newItem: CartItem = {
            name: form.productName.trim(),
            description: form.description.trim(),
            quantity: form.quantity,
            price: priceNum,
            image: currentItemPhoto,
        };

        setCart((prev) => [...prev, newItem]);
        
        // Reset item fields only, keep Recipient and Location locked in
        setForm((prev) => ({
            ...prev,
            productName: "",
            description: "",
            quantity: 1,
            price: "",
        }));
        setCurrentItemPhoto(null);
        stopFormCamera();

        setStatusMsg({ type: "success", text: `"${newItem.name}" successfully added to cart request.` });
    };

    const handleRemoveFromCart = (index: number) => {
        setCart((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Quick catalog register for admins
    const handleQuickRegister = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!form.productName.trim()) return;

        try {
            const res = await fetch("/api/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.productName.trim(),
                    description: form.description.trim() || null,
                })
            });

            if (res.ok) {
                const newItem = await res.json();
                setLocalCatalog((prev) => [...prev, newItem]);
                setStatusMsg({
                    type: "success",
                    text: `Item "${newItem.name}" has been registered in the catalog system.`,
                });
            } else {
                const errData = await res.json();
                setStatusMsg({
                    type: "error",
                    text: errData.error || "Failed to register item in catalog.",
                });
            }
        } catch {
            setStatusMsg({ type: "error", text: "Failed to connect to item registry." });
        }
    };

    // Submit the whole cart request
    const handleSubmitCart = async (e: React.FormEvent) => {
        e.preventDefault();

        if (cart.length === 0) {
            setStatusMsg({
                type: "error",
                text: "Your cart is empty. Add at least one item before submitting.",
            });
            return;
        }

        const selectedLoc = locations.find((l) => l.id === form.locationId);
        const locationName = selectedLoc ? selectedLoc.name : "Default";

        try {
            const res = await fetch("/api/payments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    recipient: form.recipient.trim(),
                    locationId: form.locationId,
                    locationName,
                    createdBy: currentUserName,
                    products: cart,
                    imageName: cart[0]?.image || null,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setTransactions((prev) => [data.transaction, ...prev]);

                // Reset all states
                setCart([]);
                setForm({
                    recipient: "",
                    productName: "",
                    description: "",
                    quantity: 1,
                    price: "",
                    locationId: "",
                });
                setStatusMsg({
                    type: "success",
                    text: "Cart request submitted successfully for approval!",
                });
            } else {
                const errData = await res.json();
                setStatusMsg({
                    type: "error",
                    text: errData.error || "Failed to submit request.",
                });
            }
        } catch {
            setStatusMsg({
                type: "error",
                text: "Could not connect to the API server.",
            });
        }
    };

    // Zoom controllers (Admin modal viewer)
    const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.25, 4));
    const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.25, 0.5));
    const handleZoomReset = () => {
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomScale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPanOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUpOrLeave = () => setIsDragging(false);

    // Reports calculations (User Targeted Reports)
    const userTxs = transactions.filter((t) => t.createdBy === currentUserName);
    
    const todayStr = new Date().toDateString();
    const dailyCompleted = userTxs.filter(
        (t) => t.status === "completed" && new Date(t.createdAt).toDateString() === todayStr
    );
    const dailyTotal = dailyCompleted.reduce((sum, t) => sum + (t.price || 0), 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyCompleted = userTxs.filter((t) => {
        const d = new Date(t.createdAt);
        return t.status === "completed" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthlyTotal = monthlyCompleted.reduce((sum, t) => sum + (t.price || 0), 0);

    // Render badge
    const renderStatusBadge = (status: Transaction["status"]) => {
        const styles = {
            pending: "bg-warning-soft text-warning border-warning/10",
            processing: "bg-info-soft text-info border-info/10",
            completed: "bg-success-soft text-success border-success/10",
            failed: "bg-destructive-soft text-destructive border-destructive/10",
        };

        const labels = {
            pending: "Pending",
            processing: "Processing",
            completed: "Approved",
            failed: "Failed",
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
            {/* TAB Navigation */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab("request")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                        activeTab === "request"
                            ? "border-highlight text-highlight"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Request Expense
                </button>
                <button
                    onClick={() => setActiveTab("reports")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                        activeTab === "reports"
                            ? "border-highlight text-highlight"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    My Expense Reports
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors cursor-pointer ${
                        activeTab === "history"
                            ? "border-highlight text-highlight"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Transaction History ({transactions.length})
                </button>
            </div>

            {statusMsg && (
                <Alert variant={statusMsg.type === "success" ? "success" : "error"} dismissible>
                    <AlertDescription>{statusMsg.text}</AlertDescription>
                </Alert>
            )}

            {/* TAB 1: Request Expense */}
            {activeTab === "request" && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Add Item Form (Left Column) */}
                    <div className="lg:col-span-2">
                        <Panel title="Assemble Expense Request">
                            <form onSubmit={handleSubmitCart} className="space-y-4 p-5">
                                {/* Recipient & Location (Locked if items exist in cart) */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="recipient">
                                            Recipient Phone / Code
                                            {cart.length > 0 && <span className="text-xs text-highlight ml-2">(Locked)</span>}
                                        </Label>
                                        <Input
                                            id="recipient"
                                            name="recipient"
                                            required
                                            disabled={cart.length > 0}
                                            placeholder="e.g. +250 788 123 456"
                                            value={form.recipient}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="locationId">
                                            Target Storage Location
                                            {cart.length > 0 && <span className="text-xs text-highlight ml-2">(Locked)</span>}
                                        </Label>
                                        <select
                                            id="locationId"
                                            name="locationId"
                                            required
                                            disabled={cart.length > 0}
                                            value={form.locationId}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-md border border-input bg-card/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-highlight disabled:opacity-70"
                                        >
                                            <option value="" disabled>Select a location...</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t border-border/40 my-4 pt-4" />

                                {/* Cart Item Input Section */}
                                <div className="space-y-3 bg-surface/20 p-4 rounded-lg border border-border/40">
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Item Details</h3>
                                    
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="productName">Product Name</Label>
                                            <Input
                                                id="productName"
                                                name="productName"
                                                placeholder="e.g. Verlet Core Board"
                                                value={form.productName}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Product Description</Label>
                                            <Input
                                                id="description"
                                                name="description"
                                                placeholder="e.g. Rev 2 Board (Optional)"
                                                value={form.description}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    {/* Catalog Stock Warning / Registry Button */}
                                    {form.productName.trim() !== "" && (
                                        <div className="flex items-center justify-between text-xs p-2.5 rounded border bg-card/60">
                                            {itemExistsInCatalog ? (
                                                <span className="text-success flex items-center gap-1 font-medium">
                                                    <Check className="h-3.5 w-3.5" /> Item verified in catalog stock.
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-warning flex items-center gap-1 font-medium">
                                                        <AlertTriangle className="h-3.5 w-3.5" /> Not found in catalog registry.
                                                    </span>
                                                    {role === "admin" ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleQuickRegister}
                                                            className="px-2 py-1 rounded bg-highlight text-highlight-foreground text-[10px] font-semibold hover:bg-highlight/95 transition-colors cursor-pointer"
                                                        >
                                                            Quick Register Item
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">
                                                            Will request registration on submission
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="quantity">Quantity</Label>
                                            <Input
                                                id="quantity"
                                                name="quantity"
                                                type="number"
                                                min={1}
                                                value={form.quantity}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="price">Unit Price (RWF)</Label>
                                            <Input
                                                id="price"
                                                name="price"
                                                type="number"
                                                min={1}
                                                placeholder="e.g. 15000"
                                                value={form.price}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    {/* Item Photo Upfront Capture (Webcam Only) */}
                                    <div className="space-y-2 pt-2">
                                        <Label className="flex items-center gap-1.5">
                                            <Camera className="h-4 w-4 text-muted-foreground" />
                                            Purchased Item Photo <span className="text-highlight">*</span>
                                        </Label>
                                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border bg-black/40 flex items-center justify-center">
                                            {!currentItemPhoto ? (
                                                !formCameraStream ? (
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground p-6 text-center">
                                                        <Camera className="h-8 w-8 opacity-40 mb-1" />
                                                        <p className="text-xs">Take a photo of the item you bought before adding it to the cart.</p>
                                                        <button
                                                            type="button"
                                                            onClick={startFormCamera}
                                                            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-highlight text-highlight-foreground text-xs font-semibold hover:bg-highlight/95 transition-colors cursor-pointer"
                                                        >
                                                            Turn on Camera
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <video
                                                            ref={formVideoRef}
                                                            autoPlay
                                                            playsInline
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="border-2 border-dashed border-highlight/40 w-3/4 h-3/4 rounded-md" />
                                                        </div>
                                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleCaptureFormPhoto}
                                                                className="px-3 py-1.5 rounded-md bg-highlight text-highlight-foreground text-xs font-bold hover:bg-highlight/90 shadow transition-colors cursor-pointer flex items-center gap-1"
                                                            >
                                                                <Camera className="h-3.5 w-3.5" /> Capture Photo
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={stopFormCamera}
                                                                className="px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-semibold hover:bg-hover transition-colors text-foreground cursor-pointer"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </>
                                                )
                                            ) : (
                                                <>
                                                    <img
                                                        src={currentItemPhoto}
                                                        alt="Captured item preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleRetakeFormPhoto}
                                                        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 shadow transition-colors cursor-pointer"
                                                    >
                                                        Retake Photo
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-surface border border-border text-xs font-semibold text-foreground hover:bg-hover transition-colors cursor-pointer"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add to Request Cart
                                        </button>
                                    </div>
                                </div>

                                {/* Form Submit (Whole Cart) */}
                                {cart.length > 0 && (
                                    <div className="pt-4 border-t border-border/40">
                                        <Button type="submit" className="w-full">
                                            <Wallet className="h-4 w-4" />
                                            Submit Expense Request ({cart.length} {cart.length === 1 ? "Item" : "Items"})
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </Panel>
                    </div>

                    {/* Request Cart Summary Pane (Right Column) */}
                    <div className="lg:col-span-1">
                        <Panel
                            title="Request Cart"
                            action={
                                cart.length > 0 && (
                                    <button
                                        onClick={() => setCart([])}
                                        className="text-xs text-destructive hover:underline cursor-pointer"
                                    >
                                        Clear All
                                    </button>
                                )
                            }
                        >
                            {cart.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground">
                                    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">Your request cart is empty.</p>
                                    <p className="text-xs mt-1">Fill out the form and click &quot;Add to Request Cart&quot; to assemble.</p>
                                </div>
                            ) : (
                                <div className="p-4 space-y-4">
                                    <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto pr-1">
                                        {cart.map((item, idx) => (
                                            <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-2">
                                                <div className="flex items-center gap-2 pr-2 overflow-hidden">
                                                    {item.image && (
                                                        <img
                                                            src={item.image}
                                                            alt={item.name}
                                                            className="w-10 h-10 object-cover rounded border border-border/80 shrink-0"
                                                        />
                                                    )}
                                                    <div className="space-y-0.5 truncate">
                                                        <p className="font-semibold text-foreground truncate">{item.name}</p>
                                                        {item.description && <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>}
                                                        <p className="text-muted-foreground font-mono text-[10px]">
                                                            {item.quantity} × {formatRWF(item.price)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-bold font-mono text-foreground">
                                                        {formatRWF(item.price * item.quantity)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleRemoveFromCart(idx)}
                                                        className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t border-border/60 pt-3 flex flex-col gap-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Subtotal Items</span>
                                            <span className="font-mono">{cart.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-foreground">
                                            <span>Cumulative Total</span>
                                            <span className="font-mono text-highlight">
                                                {formatRWF(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Panel>
                    </div>
                </div>
            )}

            {/* TAB 2: User Targeted Reports */}
            {activeTab === "reports" && (
                <div className="space-y-6">
                    {/* Analytics Cards */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <Panel title="Daily Completed Expenses">
                            <div className="p-5 flex flex-col justify-center">
                                <span className="text-3xl font-extrabold font-mono text-highlight tracking-tight">
                                    {formatRWF(dailyTotal)}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1.5">
                                    Today&apos;s total for {dailyCompleted.length} completed disbursement request(s).
                                </span>
                            </div>
                        </Panel>

                        <Panel title="Monthly Completed Expenses">
                            <div className="p-5 flex flex-col justify-center">
                                <span className="text-3xl font-extrabold font-mono text-foreground tracking-tight">
                                    {formatRWF(monthlyTotal)}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1.5">
                                    This month&apos;s total for {monthlyCompleted.length} completed disbursement request(s).
                                </span>
                            </div>
                        </Panel>
                    </div>

                    {/* Stock Registry Verification Tracker */}
                    <Panel title="My Request Stock Registry Checklist">
                        <div className="p-2">
                            {userTxs.length === 0 ? (
                                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                                    No transaction requests found to evaluate.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="px-5">Product Name</TableHead>
                                            <TableHead className="px-5">Tx Date</TableHead>
                                            <TableHead className="px-5">Tx Status</TableHead>
                                            <TableHead className="px-5 text-right">Stock Registry Verification</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userTxs.map((tx) => {
                                            const subItems = tx.products || [
                                                { name: tx.productName, quantity: tx.quantity }
                                            ];
                                            return subItems.map((prod, pIdx) => {
                                                const isInStockCatalog = localCatalog.some(
                                                    (c) => c.name.toLowerCase() === prod.name.toLowerCase()
                                                );
                                                return (
                                                    <TableRow key={`${tx.id}-${pIdx}`}>
                                                        <TableCell className="px-5 font-semibold text-foreground">
                                                            {prod.name}
                                                        </TableCell>
                                                        <TableCell className="px-5 text-xs text-muted-foreground">
                                                            {new Date(tx.createdAt).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="px-5">
                                                            {renderStatusBadge(tx.status)}
                                                        </TableCell>
                                                        <TableCell className="px-5 text-right">
                                                            {isInStockCatalog ? (
                                                                <span className="inline-flex items-center gap-1 text-xs text-success font-medium bg-success-soft border border-success/15 px-2.5 py-0.5 rounded-full">
                                                                    <Check className="h-3 w-3" /> Recorded in Catalog Stock
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs text-warning font-medium bg-warning-soft border border-warning/15 px-2.5 py-0.5 rounded-full">
                                                                    <AlertTriangle className="h-3 w-3" /> Pending Catalog Recording
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            });
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </Panel>
                </div>
            )}

            {/* TAB 3: Transaction History */}
            {activeTab === "history" && (
                <Panel
                    title="Corporate Request Ledger"
                    action={
                        <span className="text-xs text-muted-foreground">
                            {transactions.length} total entries
                        </span>
                    }
                >
                    {transactions.length === 0 ? (
                        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                            No expense transactions submitted yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="px-5">Recipient Phone / Code</TableHead>
                                        <TableHead className="px-5">Product Details</TableHead>
                                        <TableHead className="px-5">Requested By</TableHead>
                                        <TableHead className="px-5">Location</TableHead>
                                        <TableHead className="px-5 text-right">Total Price</TableHead>
                                        <TableHead className="px-5 text-right">Status</TableHead>
                                        <TableHead className="px-5 text-right">Item Photo</TableHead>
                                        <TableHead className="px-5 text-right">Receipt Photo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((tx) => {
                                        const totalAmt = tx.price; // Sum mapped from route proxy
                                        const hasReceipt = !!tx.imageName;

                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell className="px-5 font-semibold text-foreground">
                                                    {tx.recipient}
                                                </TableCell>
                                                <TableCell className="px-5 text-muted-foreground max-w-xs">
                                                    {tx.products && tx.products.length > 0 ? (
                                                        <div className="space-y-1">
                                                            <div className="font-semibold text-xs text-foreground">
                                                                {tx.productName}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground font-mono">
                                                                {tx.products.map(p => `${p.name} (×${p.quantity})`).join(", ")}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="font-semibold text-xs text-foreground">
                                                                {tx.productName}
                                                            </div>
                                                            {tx.description && <div className="text-[10px] text-muted-foreground">{tx.description}</div>}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-5 text-muted-foreground font-medium text-xs">
                                                    {tx.createdBy}
                                                </TableCell>
                                                <TableCell className="px-5 text-muted-foreground text-xs">
                                                    {tx.locationName || "—"}
                                                </TableCell>
                                                <TableCell className="px-5 text-right font-mono tabular-nums text-foreground font-bold">
                                                    {formatRWF(totalAmt)}
                                                </TableCell>
                                                <TableCell className="px-5 text-right">
                                                    {renderStatusBadge(tx.status)}
                                                </TableCell>
                                                <TableCell className="px-5 text-right">
                                                    {tx.itemPhoto ? (
                                                        <button
                                                            onClick={() => {
                                                                setViewingPhotoBase64(tx.itemPhoto || null);
                                                                setViewingPhotoTx(tx);
                                                            }}
                                                            className="inline-flex h-7 px-2.5 items-center gap-1 rounded bg-success-soft text-success text-xs font-semibold hover:bg-success/20 transition-colors cursor-pointer"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" /> View Photo
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground italic">No Photo</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-5 text-right">
                                                    {tx.receiptPhoto ? (
                                                        <button
                                                            onClick={() => {
                                                                setViewingPhotoBase64(tx.receiptPhoto || null);
                                                                setViewingPhotoTx(tx);
                                                            }}
                                                            className="inline-flex h-7 px-2.5 items-center gap-1 rounded bg-success-soft text-success text-xs font-semibold hover:bg-success/20 transition-colors cursor-pointer"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" /> View Receipt
                                                        </button>
                                                    ) : (
                                                        tx.status === "completed" ? (
                                                            role === "member" || tx.createdBy === currentUserName ? (
                                                                <button
                                                                    onClick={() => startCaptureCamera(tx)}
                                                                    className="inline-flex h-7 px-2.5 items-center gap-1.5 rounded-md bg-highlight-soft text-highlight text-xs font-bold hover:bg-highlight/25 transition-colors cursor-pointer border border-highlight/20"
                                                                >
                                                                    <Upload className="h-3 w-3" />
                                                                    Capture Receipt
                                                                </button>
                                                            ) : (
                                                                <span className="text-[11px] text-warning italic font-medium">Missing Receipt</span>
                                                            )
                                                        ) : (
                                                            <span className="text-[11px] text-muted-foreground italic">Pending Approval</span>
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Panel>
            )}

            {/* Webcam Receipt Photo Capture Modal */}
            <Dialog open={!!capturingTx} onOpenChange={(open) => !open && closeCaptureModal()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-serif font-bold text-foreground">
                            Capture Receipt
                        </DialogTitle>
                        <DialogDescription className="text-[10px] text-muted-foreground">
                            Snap a picture of the receipt to finalize this transaction record.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                        {/* Live Video Feed or Captured Preview */}
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-black flex items-center justify-center">
                            {!itemPhotoBase64 ? (
                                <>
                                    <video
                                        ref={videoRef}
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
                                    src={itemPhotoBase64}
                                    alt="Captured preview"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            {!itemPhotoBase64 ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={closeCaptureModal}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 bg-highlight hover:bg-highlight/90 text-highlight-foreground"
                                        onClick={handleCapturePhoto}
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
                                        onClick={handleRetake}
                                    >
                                        Retake Photo
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                                        onClick={handleSubmitItemPhoto}
                                    >
                                        <Check className="h-4 w-4" /> Submit Receipt
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Zoomable Purchased Item / Receipt Photo Viewer Modal (Admin) */}
            <Dialog 
                open={!!viewingPhotoBase64} 
                onOpenChange={(open) => {
                    if (!open) {
                        setViewingPhotoBase64(null);
                        setViewingPhotoTx(null);
                        handleZoomReset();
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-serif font-bold text-foreground">
                            {viewingPhotoTx && viewingPhotoBase64 === viewingPhotoTx.receiptPhoto 
                                ? "Verify Receipt Photo" 
                                : "Verify Purchased Item Photo"}
                        </DialogTitle>
                        {viewingPhotoTx && (
                            <DialogDescription className="text-[10px] text-muted-foreground font-mono">
                                Tx: {viewingPhotoTx.id} | Buyer: {viewingPhotoTx.createdBy}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {(() => {
                        const isReceipt = viewingPhotoTx && viewingPhotoBase64 === viewingPhotoTx.receiptPhoto;
                        const productsWithImages = !isReceipt && viewingPhotoTx?.products?.filter(p => !!p.image) || [];
                        return (
                            <div className="flex flex-col gap-4 py-2">
                                {/* Zoomable Viewport */}
                                <div 
                                    className="relative flex items-center justify-center h-[380px] bg-black/95 overflow-hidden select-none cursor-grab active:cursor-grabbing rounded-lg border border-border"
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUpOrLeave}
                                    onMouseLeave={handleMouseUpOrLeave}
                                >
                                    <img
                                        src={viewingPhotoBase64 || undefined}
                                        alt="Transaction Attachment"
                                        style={{
                                            transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
                                            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                                        }}
                                        className="max-h-full max-w-full object-contain pointer-events-none"
                                    />
                                </div>
                                
                                {/* Multi-Photo Thumbnail Selectors */}
                                {productsWithImages.length > 1 && (
                                    <div className="flex gap-2 justify-center overflow-x-auto py-1 border-t border-border/40 pt-3">
                                        {productsWithImages.map((p, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    if (p.image) {
                                                        setViewingPhotoBase64(p.image);
                                                        handleZoomReset();
                                                    }
                                                }}
                                                className={`relative w-12 h-12 rounded border-2 overflow-hidden shrink-0 transition-colors cursor-pointer ${
                                                    viewingPhotoBase64 === p.image 
                                                        ? "border-highlight" 
                                                        : "border-border/40 hover:border-border"
                                                }`}
                                                title={p.name}
                                            >
                                                <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Controls Toolbar */}
                                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleZoomOut}
                                            className="px-2.5 py-1 text-xs bg-surface border border-border hover:bg-hover rounded font-semibold text-foreground cursor-pointer"
                                        >
                                            Zoom -
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleZoomIn}
                                            className="px-2.5 py-1 text-xs bg-surface border border-border hover:bg-hover rounded font-semibold text-foreground cursor-pointer"
                                        >
                                            Zoom +
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleZoomReset}
                                            className="px-2.5 py-1 text-xs bg-surface border border-border hover:bg-hover rounded font-semibold text-foreground cursor-pointer"
                                        >
                                            Reset Zoom
                                        </button>
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                                        Scale: {Math.round(zoomScale * 100)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
