"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Save, Users } from "lucide-react";
import { saveMembershipOpenPlayDiscount } from "@/app/(workspace)/admin/settings/membership-actions";
import { maxMembershipPrice, type MembershipPlan } from "@/lib/membership";
import { parseSettingNumber } from "@/lib/settings-input";
import styles from "./membership-editor.module.css";

export function MembershipOpenPlayDiscountEditor({ plan }: { plan: MembershipPlan }) {
  const [saved, setSaved] = useState(plan.openPlayDiscount);
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [amount, setAmount] = useState(saved ? String(saved.amountCents / 100) : "");
  const [floor, setFloor] = useState(saved ? String(saved.floorCents / 100) : "");
  const [feedback, setFeedback] = useState<{ error: string } | { saved: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = `membership-open-play-discount-${plan.id}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || pending) return;
    const bounds = { min: 0.01, max: maxMembershipPrice };
    const discount = parseSettingNumber(amount, bounds).value;
    const minimum = parseSettingNumber(floor, bounds).value;
    if (discount == null || minimum == null) {
      setFeedback({ error: "Enter a valid discount and minimum discounted price." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await saveMembershipOpenPlayDiscount(plan.id, {
          enabled, amountCents: Math.round(discount * 100), floorCents: Math.round(minimum * 100), revision: saved.revision,
        });
        if ("error" in result) setFeedback(result);
        else {
          setSaved(result.discount);
          setAmount(String(result.discount.amountCents / 100));
          setFloor(String(result.discount.floorCents / 100));
          setFeedback({ saved: "Open-play discount saved." });
        }
      } catch { setFeedback({ error: "The open-play discount couldn’t be saved. Please try again." }); }
    });
  }

  return <section className={`console-panel settings-card ${styles.courtDiscount}`} aria-labelledby={heading}>
    <header className="settings-card-heading">
      <span className="settings-card-icon"><Users size={20} aria-hidden="true" /></span>
      <div><h2 id={heading}>Open-play discount</h2>
        <p>Applies to one pass per active member per session, for online bookings and walk-ins.</p></div>
    </header>
    <form className="settings-card-body" onSubmit={submit}>
      {!saved ? <p className="small-print">Apply migration 046 to edit the open-play discount.</p> : <>
        <fieldset className={styles.fields} disabled={pending}>
          <legend className="sr-only">Open-play discount settings</legend>
          <label className="toggle-field">
            <input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); setFeedback(null); }} />
            <span>Apply to eligible open-play passes</span>
          </label>
          <div className="field-grid">
            <label className="field"><span>Discount per member pass (PHP)</span>
              <input required inputMode="decimal" maxLength={9} value={amount}
                onChange={(event) => { setAmount(event.target.value); setFeedback(null); }} />
            </label>
            <label className="field"><span>Minimum discounted price (PHP)</span>
              <input required inputMode="decimal" maxLength={9} value={floor}
                onChange={(event) => { setFloor(event.target.value); setFeedback(null); }} />
              <small>Sessions already at or below this price keep their regular rate.</small>
            </label>
          </div>
        </fieldset>
        {feedback && ("error" in feedback
          ? <p className="error-message" role="alert">{feedback.error}</p>
          : <p className="success-message" role="status">{feedback.saved}</p>)}
        <div><button className="console-button primary" disabled={pending}>
          <Save size={16} aria-hidden="true" />{pending ? "Saving…" : "Save open-play discount"}
        </button></div>
      </>}
    </form>
  </section>;
}
