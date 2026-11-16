"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Save, Wallet } from "lucide-react";
import { saveMembershipCourtDiscount } from "@/app/(workspace)/admin/settings/membership-actions";
import { maxMembershipPrice, type MembershipPlan } from "@/lib/membership";
import { parseSettingNumber } from "@/lib/settings-input";
import styles from "./membership-editor.module.css";

export function MembershipDiscountEditor({ plan }: { plan: MembershipPlan }) {
  const [saved, setSaved] = useState(plan.courtDiscount);
  const [enabled, setEnabled] = useState(plan.courtDiscount?.enabled ?? false);
  const [amount, setAmount] = useState(plan.courtDiscount ? String(plan.courtDiscount.amountCents / 100) : "");
  const [minHours, setMinHours] = useState(plan.courtDiscount?.minHours ?? 1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const annual = plan.id === "annual";
  const heading = `membership-court-discount-${plan.id}`;

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || pending) return;
    clearFeedback();
    const parsed = parseSettingNumber(amount, { min: 0.01, max: maxMembershipPrice });
    if (parsed.value == null) {
      setError(parsed.error ?? "Enter a valid discount amount.");
      return;
    }
    const amountCents = Math.round(parsed.value * 100);

    startTransition(async () => {
      try {
        const result = await saveMembershipCourtDiscount(plan.id, {
          enabled, amountCents, minHours, revision: saved.revision,
        });
        if ("error" in result) setError(result.error);
        else {
          setSaved(result.discount);
          setAmount(String(result.discount.amountCents / 100));
          setMessage("Court discount saved.");
        }
      } catch { setError("The court discount couldn’t be saved. Please try again."); }
    });
  }

  return <section className={`console-panel settings-card ${styles.courtDiscount}`} aria-labelledby={heading}>
    <header className="settings-card-heading">
      <span className="settings-card-icon"><Wallet size={20} aria-hidden="true" /></span>
      <div><h2 id={heading}>Online private court discount</h2>
        <p>The saved terms apply to eligible new bookings and appear on the Membership page.</p></div>
    </header>
    <form className="settings-card-body" onSubmit={submit}>
      {!saved ? <p className="small-print">Apply migration 039 to edit court discounts.</p> : <>
        <fieldset className={styles.fields} disabled={pending}>
          <legend className="sr-only">Court discount settings</legend>
          <label className="toggle-field">
            <input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); clearFeedback(); }} />
            <span>Apply to eligible online bookings</span>
          </label>
          <div className="field-grid">
            <label className="field"><span>{annual ? "Discount per booking (PHP)" : "Evening rate cap per hour (PHP)"}</span>
              <input required inputMode="decimal" maxLength={9} value={amount}
                onChange={(event) => { setAmount(event.target.value); clearFeedback(); }} />
              <small>{annual ? "Applied once to the court rental." : "Members pay the lower of this cap and the scheduled evening rate."}</small>
            </label>
            {annual && <label className="field"><span>Minimum booking duration</span>
              <select value={minHours} onChange={(event) => { setMinHours(Number(event.target.value)); clearFeedback(); }}>
                {[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}
              </select>
            </label>}
          </div>
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
        {message && <p className="success-message" role="status">{message}</p>}
        <div><button className="console-button primary" disabled={pending}>
          <Save size={16} aria-hidden="true" />{pending ? "Saving…" : "Save discount"}
        </button></div>
      </>}
    </form>
  </section>;
}
