"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { deleteOwnAccount } from "@/app/(workspace)/account/actions";
import { accountDeletionConfirmation } from "@/lib/account-roles";
import type { AccountDeletionResult } from "@/lib/account-deletion";
import { Modal } from "./modal";
import { useAnimatedModal } from "./use-animated-modal";
import styles from "./account-roles.module.css";

export function DeleteOwnAccount({ email }: { email?: string }) {
  const [open, setOpen, closing] = useAnimatedModal<boolean>();

  return <section className={`panel ${styles.deletePanel}`} aria-labelledby="delete-account-heading">
    <div>
      <h2 className="form-section-title" id="delete-account-heading">Delete account</h2>
      <p className="small-print">Permanently remove your Ascent account and sign-in access.</p>
    </div>
    <button type="button" className={`button button-outline ${styles.dangerButton}`} onClick={() => setOpen(true)}>
      <Trash2 size={16} aria-hidden="true" /> Delete my account
    </button>
    {open && <DeleteAccountDialog email={email} own closing={closing} onClose={() => setOpen(null)}
      deleteAccount={deleteOwnAccount} onDeleted={() => window.location.replace("/login?deleted=1")} />}
  </section>;
}

export function DeleteAccountDialog({ email, own = false, closing, onClose, deleteAccount, onDeleted }: {
  email?: string;
  own?: boolean;
  closing: boolean;
  onClose: () => void;
  deleteAccount: (confirmation: string) => Promise<AccountDeletionResult>;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = confirmation === accountDeletionConfirmation;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending || closing) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteAccount(confirmation);
        if (result.ok) onDeleted();
        else setError(result.error);
      } catch {
        setError("We couldn’t confirm account deletion. Refresh the page to check.");
      }
    });
  }

  return <Modal title={own ? "Delete your account?" : "Delete this account?"}
    closing={closing} onClose={() => !pending && onClose()}>
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <div className={styles.email}>
        {email && <strong>{email}</strong>}
        <p className="small-print">This permanently removes sign-in access and cancels pending pickup orders. Staff keep booking, membership, and payment records.</p>
      </div>
      <label className="field">
        <span>Type {accountDeletionConfirmation} to confirm</span>
        <input value={confirmation} onChange={(event) => setConfirmation(event.currentTarget.value)}
          disabled={pending || closing} autoComplete="off" spellCheck={false} required />
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className="button button-outline" type="button" disabled={pending || closing} onClick={onClose}>Cancel</button>
        <button className={`button ${styles.dangerButton} ${styles.dangerConfirm}`} type="submit"
          disabled={!confirmed || pending || closing}>{pending ? "Deleting…" : "Delete account"}</button>
      </div>
    </form>
  </Modal>;
}
