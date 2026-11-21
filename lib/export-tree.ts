"use client";

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export interface ExportOptions {
  elementId: string;
  fileNameBase: string;
  format: "png" | "pdf";
  orientation?: "landscape" | "portrait";
  backgroundColor?: string;
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return cleaned || "bangla-family-tree";
}

export async function exportTreeGraphics({
  elementId,
  fileNameBase,
  format,
  orientation = "landscape",
  backgroundColor = "#f8fafc",
}: ExportOptions): Promise<void> {
  const targetEl = document.getElementById(elementId);
  if (!targetEl) {
    throw new Error("এক্সপোর্ট করার ক্যানভাস খুঁজে পাওয়া যায়নি।");
  }

  // Wait for all web fonts (including Bengali fonts) to finish loading
  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }

  // Small delay so layout & SVG strokes settle cleanly
  await new Promise((resolve) => setTimeout(resolve, 120));

  const dataUrl = await toPng(targetEl, {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor,
    filter: (node) => {
      // Exclude React Flow interactive controls/minimap/attribution from exported graphics
      if (node instanceof HTMLElement) {
        if (
          node.classList.contains("react-flow__controls") ||
          node.classList.contains("react-flow__minimap") ||
          node.classList.contains("react-flow__attribution") ||
          node.dataset.exportIgnore === "true"
        ) {
          return false;
        }
      }
      return true;
    },
  });

  const safeBase = sanitizeFileName(fileNameBase);

  if (format === "png") {
    const link = document.createElement("a");
    link.download = `${safeBase}.png`;
    link.href = dataUrl;
    link.click();
    return;
  }

  // Generate PDF with proper aspect ratio and margins
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("ইমেজ লোড করতে সমস্যা হয়েছে।"));
  });

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a3",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgAspect = img.naturalWidth / img.naturalHeight;
  let renderWidth = usableWidth;
  let renderHeight = renderWidth / imgAspect;

  if (renderHeight > usableHeight) {
    renderHeight = usableHeight;
    renderWidth = renderHeight * imgAspect;
  }

  const offsetX = (pageWidth - renderWidth) / 2;
  const offsetY = (pageHeight - renderHeight) / 2;

  pdf.addImage(dataUrl, "PNG", offsetX, offsetY, renderWidth, renderHeight, undefined, "FAST");
  pdf.save(`${safeBase}.pdf`);
}
