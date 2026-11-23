"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

import { cx } from "@/components/ui";
import { fmtBytes } from "@/lib/format";

export function FileDropzone({
  file,
  onFile,
  accept = ".txt,text/plain",
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cx(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm",
        over ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400",
      )}
    >
      <FileUp className="h-5 w-5 text-slate-400" aria-hidden />
      {file ? (
        <p className="font-medium text-slate-800">
          {file.name} <span className="font-normal text-slate-500">({fmtBytes(file.size)})</span>
        </p>
      ) : (
        <p className="text-slate-600">
          Drop a <span className="font-mono">.txt</span> guideline file or click to browse
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
