"use client";

import { useState } from "react";
import { exportTreeGraphics } from "@/lib/export-utils";
import { X, Download, Image as ImageIcon, FileText, Loader2, Sparkles } from "lucide-react";

export type GraphicsTheme = "emerald" | "royal" | "minimal";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeTitle: string;
  canvasElementId: string;
  theme: GraphicsTheme;
  onChangeTheme: (theme: GraphicsTheme) => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  treeTitle,
  canvasElementId,
  theme,
  onChangeTheme,
}: ExportModalProps) {
  const [format, setFormat] = useState<"png" | "pdf">("pdf");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const bgByTheme: Record<GraphicsTheme, string> = {
    emerald: "#f0fdf4",
    royal: "#fffbeb",
    minimal: "#f8fafc",
  };

  async function handleDownload() {
    setDownloading(true);
    setErrorMsg(null);
    try {
      await exportTreeGraphics({
        elementId: canvasElementId,
        fileNameBase: treeTitle || "bangla-family-tree",
        format,
        orientation,
        backgroundColor: bgByTheme[theme],
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "ডাউনলোড করতে সমস্যা হয়েছে।"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              গ্রাফিক্সসহ ডাউনলোড করুন
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 mt-5">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ফাইল ফরম্যাট
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                  format === "pdf"
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold">PDF ডকুমেন্ট</div>
                  <div className="text-[11px] text-slate-500">প্রিন্ট ও শেয়ার উপযোগী</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("png")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                  format === "png"
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <ImageIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold">PNG ছবি</div>
                  <div className="text-[11px] text-slate-500">হাই-রেজোলিউশন ইমেজ</div>
                </div>
              </button>
            </div>
          </div>

          {/* Graphics Theme */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              বর্ডার ও গ্রাফিক্স থিম
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeTheme("emerald")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  theme === "emerald"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                পান্না ফ্রেম
              </button>
              <button
                type="button"
                onClick={() => onChangeTheme("royal")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  theme === "royal"
                    ? "border-amber-600 bg-amber-50 text-amber-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                রয়্যাল গোল্ড
              </button>
              <button
                type="button"
                onClick={() => onChangeTheme("minimal")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  theme === "minimal"
                    ? "border-slate-800 bg-slate-100 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ক্লিন মডার্ন
              </button>
            </div>
          </div>

          {/* PDF Orientation */}
          {format === "pdf" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                PDF পেজ ওরিয়েন্টেশন
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    orientation === "landscape"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Landscape (আড়াআড়ি)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    orientation === "portrait"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Portrait (লম্বালম্বি)
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 cursor-pointer"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                তৈরি হচ্ছে...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                ডাউনলোড করুন
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
