"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, Trash2, UploadCloud, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

interface ReceiptUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  txId: string;
  onUploadSuccess: (txId: string, receiptBase64: string) => void;
}

export function ReceiptUploadDialog({
  isOpen,
  onClose,
  txId,
  onUploadSuccess,
}: ReceiptUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Clean up camera stream on close / unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setErrorMsg(null);
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
      setErrorMsg("Could not access the camera. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 2 * 1024 * 1024) {
        setErrorMsg("File size exceeds 2MB limit.");
        return;
      }
      setFile(selected);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/payments/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: txId, receipt_base64: base64 }),
      });

      if (res.ok) {
        onUploadSuccess(txId, base64);
        handleClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || "Failed to upload receipt.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Network error. Failed to connect to server.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setFile(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold font-serif text-foreground">
              Upload Transaction Receipt
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Please capture or upload an invoice/receipt image for this transaction.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg && (
            <div className="rounded-md bg-destructive-soft p-3 text-xs text-destructive font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          {/* Camera View */}
          {isCameraActive && (
            <div className="relative overflow-hidden rounded-lg border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-[260px] object-cover"
              />
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-success text-success-foreground hover:bg-success/90 shadow-md text-xs h-8 px-3"
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  Capture Photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={stopCamera}
                  className="shadow-md text-xs h-8 px-3"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Default Upload Dropzone */}
          {!isCameraActive && !file && (
            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-input bg-surface/30 px-4 py-8 transition-colors hover:border-highlight/40 cursor-pointer text-center">
                <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-[12px] font-medium text-foreground">
                  Drag and drop or choose file
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  JPEG, PNG, WebP up to 2MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <div className="text-center text-xs text-muted-foreground font-semibold py-1">
                — OR —
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 h-10"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
                Open Camera & Take Photo
              </Button>
            </div>
          )}

          {/* Image Selected Preview */}
          {!isCameraActive && file && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface/20 p-3 space-y-3">
              <img
                src={URL.createObjectURL(file)}
                alt="Selected receipt preview"
                className="max-h-[180px] rounded-md object-contain border border-line shadow-sm"
              />
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-muted-foreground font-mono font-medium truncate max-w-[200px]">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="inline-flex h-6 px-2 items-center gap-1 rounded-md bg-destructive-soft text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="flex items-center gap-1.5"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Receipt"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
