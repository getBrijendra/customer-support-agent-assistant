"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Field, Textarea } from "@/components/ui";

/**
 * A button that opens a native <dialog> to confirm a destructive or important action.
 * With `withNote`, the dialog asks for a free-text note/reason that is passed to onConfirm.
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "secondary",
  confirmVariant = "danger",
  size = "sm",
  withNote,
  noteLabel = "Reason (optional)",
  loading,
  disabled,
  onConfirm,
}: {
  label: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  confirmVariant?: "primary" | "danger" | "success";
  size?: "sm" | "md";
  withNote?: boolean;
  noteLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: (note: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <Button variant={variant} size={size} loading={loading} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-md rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <form
          method="dialog"
          className="space-y-4 p-5"
          onSubmit={() => {
            onConfirm(note.trim());
            setNote("");
          }}
        >
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && <div className="text-sm text-slate-600">{description}</div>}
          {withNote && (
            <Field label={noteLabel}>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={confirmVariant}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
