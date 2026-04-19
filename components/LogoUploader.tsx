"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function LogoUploader({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file (PNG, JPG, SVG, etc.)");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          onChange(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          readFile(file);
          setPasteFlash(true);
          setTimeout(() => setPasteFlash(false), 800);
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [readFile]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        ref={dropRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all
          ${dragOver ? "border-brand-300 bg-brand-500/10" : "border-brand-500/30 bg-bg-card/50"}
          ${pasteFlash ? "animate-browser-glow" : ""}
          flex flex-col items-center justify-center
          h-56 px-6 text-center hover:border-brand-300 hover:bg-brand-500/5`}
      >
        {value ? (
          <div className="flex flex-col items-center">
            <img
              src={value}
              alt="Company logo"
              className="max-h-32 max-w-[200px] object-contain rounded-lg shadow-xl"
            />
            <p className="text-xs text-brand-100/60 mt-3">
              Click or paste again to change
            </p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">🖼️</div>
            <p className="font-medium text-brand-100">
              Click, drag, or paste your logo
            </p>
            <p className="text-xs text-brand-100/60 mt-2">
              Press{" "}
              <kbd className="px-2 py-0.5 rounded border border-brand-500/40 bg-bg-soft text-brand-200">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="px-2 py-0.5 rounded border border-brand-500/40 bg-bg-soft text-brand-200">
                V
              </kbd>{" "}
              to paste an image from clipboard
            </p>
            <p className="text-[10px] text-brand-100/40 mt-3">
              PNG, JPG, SVG, WEBP — up to ~2MB
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
          }}
        />
      </div>

      {value && (
        <button
          type="button"
          className="text-xs text-rose-300 hover:text-rose-200 underline"
          onClick={() => onChange(null)}
        >
          Remove logo
        </button>
      )}
    </div>
  );
}
