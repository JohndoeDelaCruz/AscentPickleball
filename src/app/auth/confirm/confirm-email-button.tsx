"use client";

import { ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ConfirmEmailButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "Confirming…" : "Confirm and continue"}
        {pending ? <span className="spinner" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">{pending ? "Confirming your email…" : ""}</span>
    </>
  );
}
