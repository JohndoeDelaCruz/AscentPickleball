"use client";
import { useRef, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Upload } from "lucide-react";
import { saveVenueSetting, saveSettings } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import {
  canBook,
  equipmentPackageLabel,
  openPlayCapacityLabel,
} from "@/lib/booking";
import type { VenueSettings } from "@/lib/types";
import { TypedSettingField } from "./typed-setting-field";
import type { IndividualSettingKey } from "@/lib/venue-setting";

type SettingFieldOptions = Pick<
  ComponentProps<typeof TypedSettingField>,
  "label" | "kind" | "min" | "max" | "optional" | "hint" | "placeholder"
>;
type FieldFeedback = { error?: string; message?: string };

export function SettingsForm({ initial }: { initial: VenueSettings }) {
  const [venue, setVenue] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldPending, startFieldTransition] = useTransition();
  const [applyingField, setApplyingField] =
    useState<IndividualSettingKey | null>(null);
  const [fieldFeedback, setFieldFeedback] = useState<
    Partial<Record<IndividualSettingKey, FieldFeedback>>
  >({});
  const fieldInputs = useRef<
    Partial<Record<IndividualSettingKey, HTMLInputElement | null>>
  >({});
  const router = useRouter();
  function update<K extends keyof VenueSettings>(
    key: K,
    value: VenueSettings[K],
  ) {
    setVenue((old) => ({ ...old, [key]: value }));
    setMessage("");
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG, or WebP image up to 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/jpeg"
            ? "jpg"
            : "webp";
      const path = `gcash/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("venue-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("venue-assets").getPublicUrl(path);
      update("gcash_qr_url", data.publicUrl);
      setMessage("QR uploaded. Save your settings to publish it.");
    } catch {
      setError(
        "We couldn’t upload the QR. Please try again, or paste a direct https:// image URL.",
      );
    } finally {
      setUploading(false);
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (fieldPending) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveSettings(venue);
      if (result.error) setError(result.error);
      else {
        setFieldFeedback({});
        setMessage("Settings saved. Your website is up to date.");
        router.refresh();
      }
    });
  }
  function applyField(key: IndividualSettingKey) {
    if (
      pending ||
      fieldPending ||
      uploading ||
      !fieldInputs.current[key]?.reportValidity()
    )
      return;
    const value = venue[key];
    setApplyingField(key);
    setFieldFeedback((old) => ({ ...old, [key]: {} }));
    startFieldTransition(async () => {
      try {
        const result = await saveVenueSetting(key, value);
        if (result.error)
          setFieldFeedback((old) => ({
            ...old,
            [key]: { error: result.error },
          }));
        else
          setFieldFeedback((old) => ({
            ...old,
            [key]: {
              message:
                key === "open_play_capacity"
                  ? `Player limit applied. ${openPlayCapacityLabel(value)}.`
                  : "Applied.",
            },
          }));
      } catch {
        setFieldFeedback((old) => ({
          ...old,
          [key]: {
            error: "This setting could not be applied. Please try again.",
          },
        }));
      } finally {
        setApplyingField(null);
      }
    });
  }
  function numericField(
    key: IndividualSettingKey,
    options: SettingFieldOptions,
  ) {
    if (options.kind === "hour")
      return (
        <TypedSettingField
          key={key}
          {...options}
          value={venue[key]}
          disabled={pending || fieldPending}
          onChange={(value) => update(key, value)}
        />
      );
    const feedback = fieldFeedback[key];
    return (
      <div
        key={key}
        className="applicable-setting"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyField(key);
          }
        }}
      >
        <TypedSettingField
          {...options}
          value={venue[key]}
          inputRef={(input) => {
            fieldInputs.current[key] = input;
          }}
          disabled={pending || fieldPending}
          onDraftChange={() =>
            setFieldFeedback((old) => ({ ...old, [key]: {} }))
          }
          onChange={(value) => update(key, value)}
          action={
            <button
              type="button"
              className="button button-dark button-small"
              aria-label={
                key === "open_play_capacity"
                  ? "Apply player limit"
                  : `Apply ${options.label}`
              }
              disabled={pending || fieldPending || uploading}
              onClick={() => applyField(key)}
            >
              {fieldPending && applyingField === key ? "Applying…" : "Apply"}
            </button>
          }
        />
        {feedback?.error && (
          <div className="error-message" role="alert">
            {feedback.error}
          </div>
        )}
        {feedback?.message && (
          <div className="success-message" role="status">
            {feedback.message}
          </div>
        )}
      </div>
    );
  }
  const textField = (
    key:
      | "name"
      | "tagline"
      | "address"
      | "city"
      | "phone"
      | "email"
      | "facebook_url"
      | "gcash_name"
      | "gcash_number"
      | "gcash_qr_url",
    label: string,
    placeholder = "",
    type = "text",
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={venue[key]}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
        maxLength={
          key === "address"
            ? 300
            : key === "gcash_qr_url" || key === "facebook_url"
              ? 2000
              : 180
        }
      />
    </label>
  );
  return (
    <div className="settings-layout">
      <form className="panel form-stack" onSubmit={submit}>
        <div>
          <h2 className="form-section-title">Venue settings</h2>
        </div>
        <h3 className="form-section-title">The basics</h3>
        {textField("name", "Venue name")}
        {textField("tagline", "A short introduction")}
        {textField("address", "Street address", "Add your venue address later")}
        <div className="field-grid">
          {textField("city", "City / municipality", "Add your city later")}
          {textField(
            "phone",
            "Contact number",
            "Your venue mobile number",
            "tel",
          )}
          {textField("email", "Contact email", "hello@yourvenue.com", "email")}
          {textField(
            "facebook_url",
            "Facebook page",
            "https://facebook.com/yourpage",
            "url",
          )}
        </div>
        <hr className="form-divider" />
        <h3 className="form-section-title">Rates & hours</h3>
        <p className="small-print">
          Both courts use the same daytime and evening rates. Each booked hour
          is priced separately, including reservations that cross the evening
          start time. Optional equipment rental is added once to the booking
          total when selected, separately from the court rate.
        </p>
        <p className="small-print">
          Choose whole-hour times with the clock picker, then use Save venue
          settings to save time changes. Numeric fields can be saved
          individually with Apply.
        </p>
        <div className="field-grid">
          {numericField("hourly_rate", {
            label: "Daytime court rate (PHP / hour)",
            min: 1,
            max: 100000,
            optional: true,
            placeholder: "Not set yet",
          })}
          {numericField("evening_hourly_rate", {
            label: "Evening court rate (PHP / hour)",
            min: 0.01,
            max: 100000,
          })}
          {numericField("evening_start_hour", {
            label: "Evening rate starts at",
            kind: "hour",
            min: 1,
            max: 23,
          })}
          {numericField("equipment_rental_price", {
            label: "Equipment rental package (PHP)",
            min: 0,
            max: 100000,
            hint: `${equipmentPackageLabel(venue.equipment_ball_count)}. Added once per reservation when selected.`,
          })}
          {numericField("equipment_ball_count", {
            label: "Balls per rental paddle",
            kind: "integer",
            min: 1,
            max: 20,
          })}
          {numericField("private_court_capacity", {
            label: "Private-booking players per court",
            kind: "integer",
            min: 1,
            max: 100,
          })}
          {numericField("hold_minutes", {
            label: "Unpaid hold duration (minutes)",
            kind: "integer",
            min: 15,
            max: 120,
            hint: "Enter 15–120 minutes.",
          })}
          {numericField("opening_hour", {
            label: "Opening time",
            kind: "hour",
            min: 0,
            max: 23,
            optional: true,
            placeholder: "Not set yet",
          })}
          {numericField("closing_hour", {
            label: "Closing time",
            kind: "hour",
            min: 1,
            max: 24,
            optional: true,
            placeholder: "Not set yet",
          })}
        </div>
        <hr className="form-divider" />
        <h3 className="form-section-title">Weekend open play</h3>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={venue.open_play_enabled}
            onChange={(e) => update("open_play_enabled", e.target.checked)}
          />
          <span>
            <strong>Offer open play on Saturdays and Sundays</strong>
            <small>
              Both courts are shared during the session. Private bookings are
              available before and after it.
            </small>
          </span>
        </label>
        <div className="field-grid">
          {(
            [
              ["weekend_court_end_hour", "Morning court bookings end"],
              ["open_play_start_hour", "Open play starts"],
              ["open_play_end_hour", "Open play ends"],
            ] as const
          ).map(([key, label]) =>
            numericField(key, {
              label,
              kind: "hour",
              min: key === "open_play_end_hour" ? 1 : 0,
              max: key === "open_play_end_hour" ? 24 : 23,
            }),
          )}
          {numericField("open_play_price", {
            label: "Open-play pass (PHP / person)",
            min: 0.01,
            max: 100000,
          })}
          {numericField("open_play_capacity", {
            label: "Total player limit per weekend day (optional)",
            kind: "integer",
            min: 1,
            max: 100000,
            optional: true,
            placeholder: "No limit",
            hint: `${openPlayCapacityLabel(venue.open_play_capacity)}. Leave blank for no player limit.`,
          })}
        </div>
        <p className="small-print">
          A pass covers the whole session with player rotation. Selected
          equipment rental is added once per reservation. Changes to hours
          require resolving existing future open-play passes first; rate changes
          apply to new passes.
        </p>
        <hr className="form-divider" />
        <h3 className="form-section-title">Your GCash QR</h3>
        <p className="small-print">
          Use the QR image exported from GCash. Customers pay you directly;
          staff checks incoming payments and confirms reservations.
        </p>
        <div className="field-grid">
          {textField(
            "gcash_name",
            "GCash account name",
            "Name customers should verify",
          )}
          {textField(
            "gcash_number",
            "GCash mobile number (optional)",
            "09XXXXXXXXX",
            "tel",
          )}
        </div>
        {textField(
          "gcash_qr_url",
          "QR image URL",
          "https://… (a direct PNG, JPEG, or WebP link)",
          "url",
        )}
        <label className="field">
          <span>Or upload your QR image</span>
          <div
            style={{
              padding: 18,
              border: "1px dashed #c6d3b2",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              gap: 13,
            }}
          >
            <Upload size={20} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
              disabled={uploading || pending}
              style={{ padding: 0, border: 0, minHeight: 0 }}
            />
          </div>
          <small>
            {uploading
              ? "Uploading…"
              : "PNG, JPEG, or WebP · up to 2 MB. Save your settings after uploading."}
          </small>
        </label>
        {venue.gcash_qr_url && (
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <img
              src={venue.gcash_qr_url}
              alt="GCash QR preview"
              style={{
                width: 130,
                height: 130,
                objectFit: "contain",
                background: "white",
                border: "1px solid var(--line)",
                borderRadius: 7,
              }}
            />
            <p className="small-print">
              Check that the QR opens the right GCash account before enabling
              bookings.
            </p>
          </div>
        )}
        <hr className="form-divider" />
        <h3 className="form-section-title">Booking policy</h3>
        <label className="field">
          <span>Cancellation & refund policy</span>
          <textarea
            value={venue.cancellation_policy}
            onChange={(e) => update("cancellation_policy", e.target.value)}
            minLength={10}
            maxLength={2000}
            required
          />
          <small>
            Explain cancellations, rescheduling, and refunds. Refunds are
            handled manually through GCash.
          </small>
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={venue.booking_enabled}
            onChange={(e) => update("booking_enabled", e.target.checked)}
          />
          <span>
            <strong>Open online reservations</strong>
            <small>
              Enable after setting your rate, opening hours, GCash name, and QR.
              Turning this off stops new reservations. Existing bookings remain
              accessible.
            </small>
          </span>
        </label>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}
        <div className="settings-save">
          <button
            className="button button-dark"
            disabled={pending || fieldPending || uploading}
          >
            <Save size={16} />
            {pending ? "Saving…" : "Save venue settings"}
          </button>
          <span className="small-print">
            Changes appear on the website after saving.
          </span>
        </div>
      </form>
      <aside className="panel settings-aside">
        <span className="eyebrow">GETTING READY TO PLAY</span>
        <h3 style={{ marginTop: 13 }}>Your launch checklist</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {[
            [
              "Daytime & evening rates",
              Boolean(venue.hourly_rate && venue.evening_hourly_rate),
            ],
            [
              "Opening & closing hours",
              venue.opening_hour !== null && venue.closing_hour !== null,
            ],
            ["GCash account name", Boolean(venue.gcash_name)],
            ["GCash QR image", Boolean(venue.gcash_qr_url)],
            ["Venue address", Boolean(venue.address)],
            ["Contact details", Boolean(venue.phone || venue.email)],
          ].map(([label, done]) => (
            <li
              key={String(label)}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Check
                size={13}
                style={{ color: done ? "#49752c" : "#c7ceba" }}
              />
              {label}
            </li>
          ))}
        </ul>
        <div
          className={`notice ${canBook(venue) ? "" : "notice-warning"}`}
          style={{ marginTop: 20 }}
        >
          <span>
            {canBook(venue)
              ? "Your settings are ready for reservations. Remember to save your changes."
              : "Reservations stay closed until the required details are set and you enable booking."}
          </span>
        </div>
        <p style={{ marginTop: 20, marginBottom: 0 }}>
          Payment references need a manual check in GCash. The website never
          sends or refunds money automatically.
        </p>
      </aside>
    </div>
  );
}
