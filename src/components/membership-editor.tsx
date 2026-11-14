"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Plus, Save, Trash2, Trophy } from "lucide-react";
import { saveMembershipDetails } from "@/app/(workspace)/admin/settings/membership-actions";
import { maxMembershipBenefits, maxMembershipPrice, membershipTextLimits, type MembershipDetails } from "@/lib/membership";
import { parseSettingNumber } from "@/lib/settings-input";
import styles from "./membership-editor.module.css";

const pageTextFields = [
  { key: "introduction", label: "Page introduction" },
  { key: "validity", label: "Validity terms" },
  { key: "redemption", label: "How to use benefits" },
  { key: "home_summary", label: "Homepage summary" },
] as const;

export function MembershipEditor({ initial }: { initial: { details: MembershipDetails; revision: number | null } }) {
  const [details, setDetails] = useState(initial.details);
  const [price, setPrice] = useState(String(initial.details.price_cents / 100));
  const [revision, setRevision] = useState(initial.revision);
  const [benefitKeys, setBenefitKeys] = useState(() => initial.details.benefits.map((_, id) => ({ id, startOpen: false })));
  const nextBenefitKey = useRef(initial.details.benefits.length);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const disabled = pending || revision === null;

  function update<K extends keyof MembershipDetails>(key: K, value: MembershipDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function updateBenefit(index: number, key: "title" | "description", value: string) {
    update("benefits", details.benefits.map((benefit, position) => position === index ? { ...benefit, [key]: value } : benefit));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || revision === null) return;
    setMessage("");
    setError("");
    const amount = parseSettingNumber(price, { min: 0, max: maxMembershipPrice });
    if (amount.value == null) {
      setError(`Membership price. ${amount.error}`);
      return;
    }
    const input = { ...details, price_cents: Math.round(amount.value * 100) };
    startTransition(async () => {
      try {
        const result = await saveMembershipDetails(input, revision);
        if (result.error !== undefined) {
          setError(result.error);
          return;
        }
        setDetails(result.details);
        setPrice(String(result.details.price_cents / 100));
        setRevision(result.revision);
        setMessage("Membership details published.");
      } catch {
        setError("Membership details couldn’t be saved. Please try again.");
      }
    });
  }

  return <form className="venue-settings-form" onSubmit={submit}>
    <section className="console-panel settings-card" aria-labelledby="membership-editor-heading">
      <header className="settings-card-heading">
        <span className="settings-card-icon"><Trophy size={20} aria-hidden="true" /></span>
        <div>
          <h2 id="membership-editor-heading">Membership details</h2>
          <p>Publish the plan, price, and benefits shown on your website.</p>
        </div>
      </header>
      <div className="settings-card-body">
        {revision === null && <p className="notice notice-warning" role="status">
          Membership settings are unavailable. Apply migration 031 if it’s pending, then reload this page.
        </p>}
        <fieldset disabled={disabled} className={styles.fields}>
          <legend className="sr-only">Plan details</legend>
          <div className="field-grid">
            <label className="field"><span>Plan name</span>
              <input required value={details.plan_name} maxLength={membershipTextLimits.title}
                onChange={(event) => update("plan_name", event.target.value)} />
            </label>
            <label className="field"><span>Page heading</span>
              <input required value={details.heading} maxLength={membershipTextLimits.title}
                onChange={(event) => update("heading", event.target.value)} />
            </label>
            <label className="field"><span>Price (PHP)</span>
              <input required inputMode="decimal" maxLength={9} value={price} onChange={(event) => {
                setPrice(event.target.value);
                setMessage("");
                setError("");
              }} />
            </label>
            <label className="field"><span>Price period</span>
              <input required value={details.price_period} maxLength={membershipTextLimits.period}
                onChange={(event) => update("price_period", event.target.value)} />
              <small>For example, year or month.</small>
            </label>
          </div>
          <div className="field-grid">
            {pageTextFields.map(({ key, label }) => <label className="field" key={key}><span>{label}</span>
              <textarea required value={details[key]} maxLength={membershipTextLimits.body}
                onChange={(event) => update(key, event.target.value)} />
            </label>)}
          </div>
        </fieldset>
      </div>
    </section>
    <section className="console-panel settings-card" aria-labelledby="membership-benefits-editor-heading">
      <header className={`settings-card-heading ${styles.benefitsHeader}`}>
        <h2 id="membership-benefits-editor-heading">Membership benefits</h2>
        <button type="button" className="console-button" disabled={disabled || details.benefits.length >= maxMembershipBenefits}
          onClick={() => {
            const key = nextBenefitKey.current++;
            setBenefitKeys((current) => [...current, { id: key, startOpen: true }]);
            update("benefits", [...details.benefits, { icon: "check", title: "", description: "" }]);
          }}><Plus size={16} aria-hidden="true" /> Add benefit</button>
      </header>
      <div className={`settings-card-body ${styles.benefits}`}>
        {details.benefits.length === 0 && <p className="small-print">No benefits listed.</p>}
        {details.benefits.map((benefit, index) => (
          <details key={benefitKeys[index].id} className={`workspace-disclosure ${styles.benefit}`} open={benefitKeys[index].startOpen}>
            <summary>{benefit.title || "New benefit"}</summary>
            <fieldset disabled={disabled} className={styles.fields} onInvalid={(event) => {
              const section = event.currentTarget.closest("details");
              if (section) section.open = true;
            }}>
              <legend className="sr-only">{benefit.title || "New benefit"}</legend>
              <label className="field"><span>Benefit title</span>
                <input required value={benefit.title} maxLength={membershipTextLimits.title}
                  onChange={(event) => updateBenefit(index, "title", event.target.value)} />
              </label>
              <label className="field"><span>Description</span>
                <textarea required value={benefit.description} maxLength={membershipTextLimits.body}
                  onChange={(event) => updateBenefit(index, "description", event.target.value)} />
              </label>
              <button type="button" className="console-button" aria-label={`Remove ${benefit.title || "new benefit"}`}
                onClick={() => {
                  setBenefitKeys((current) => current.filter((_, position) => position !== index));
                  update("benefits", details.benefits.filter((_, position) => position !== index));
                }}><Trash2 size={15} aria-hidden="true" /> Remove benefit</button>
            </fieldset>
          </details>
        ))}
      </div>
    </section>
    {error && <p className="error-message" role="alert">{error}</p>}
    {message && <p className="success-message" role="status">{message}</p>}
    <div className="settings-save workspace-save-bar">
      <button className="console-button primary" disabled={disabled}>
        <Save size={16} aria-hidden="true" />{pending ? "Publishing…" : "Publish membership details"}
      </button>
      <span className="small-print">Updates the membership page and homepage.</span>
    </div>
  </form>;
}
