"use client";

import React from "react";
import { Eye, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ReceiptViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receiptBase64: string;
  txProductName: string;
}

export function ReceiptViewDialog({
  isOpen,
  onClose,
  receiptBase64,
  txProductName,
}: ReceiptViewDialogProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = receiptBase64;
    link.download = `receipt_${txProductName.toLowerCase().replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-highlight-soft text-highlight">
              <Eye className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-semibold font-serif">
              Receipt Attachment
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Receipt for item: <span className="font-semibold text-foreground">{txProductName}</span>
          </p>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/10 max-h-[300px] flex items-center justify-center p-2 mt-2">
          <img
            src={receiptBase64}
            alt="Transaction Receipt"
            className="max-h-[280px] w-full object-contain rounded-md transition-transform hover:scale-[1.02] duration-200"
          />
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end mt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleDownload} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
