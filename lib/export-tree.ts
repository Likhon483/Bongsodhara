"use client";

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export interface ExportOptions {
  elementId?: string;
  element?: HTMLElement | null;
  fileNameBase: string;
  format: "png" | "pdf";
  orientation?: "landscape" | "portrait";
  backgroundColor?: string;
  pageSize?: "a4" | "a3";
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return cleaned || "bongshodhara";
}

export async function exportTreeGraphics({
  elementId,
  element,
  fileNameBase,
  format,
  orientation = "landscape",
  backgroundColor = "#f8fafc",
  pageSize = "a3",
}: ExportOptions): Promise<void> {
  const targetEl = element || (elementId ? document.getElementById(elementId) : null);
  if (!targetEl) {
    throw new Error("এক্সপোর্ট করার ক্যানভাস খুঁজে পাওয়া যায়নি।");
  }

  // 1. Wait for document.fonts.ready so Bengali fonts are fully loaded
  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }

  // 2. Small delay so layout, font shapes, and SVG paths settle cleanly
  await new Promise((resolve) => setTimeout(resolve, 150));

  // 3. High-resolution pixel ratio: minimum 3x for crisp Bengali text and conjuncts on mobile
  const pixelRatio = Math.min(
    Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3),
    4
  );

  const dataUrl = await toPng(targetEl, {
    cacheBust: true,
    pixelRatio,
    backgroundColor,
    style: {
      fontFamily:
        "var(--font-hind-siliguri), 'Hind Siliguri', var(--font-noto-bengali), 'Noto Sans Bengali', sans-serif",
      letterSpacing: "normal",
      textRendering: "geometricPrecision",
    },
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

  // 4. Generate PDF with fit-to-page layout and clean margins
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("ইমেজ প্রস্তুত করতে সমস্যা হয়েছে।"));
  });

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const effectiveOrientation =
    orientation || (imgAspect >= 1 ? "landscape" : "portrait");

  const pdf = new jsPDF({
    orientation: effectiveOrientation,
    unit: "mm",
    format: pageSize,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12; // 12mm clean margin
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  let renderWidth = usableWidth;
  let renderHeight = renderWidth / imgAspect;

  if (renderHeight > usableHeight) {
    renderHeight = usableHeight;
    renderWidth = renderHeight * imgAspect;
  }

  const offsetX = (pageWidth - renderWidth) / 2;
  const offsetY = (pageHeight - renderHeight) / 2;

  pdf.addImage(
    dataUrl,
    "PNG",
    offsetX,
    offsetY,
    renderWidth,
    renderHeight,
    undefined,
    "FAST"
  );
  pdf.save(`${safeBase}.pdf`);
}
