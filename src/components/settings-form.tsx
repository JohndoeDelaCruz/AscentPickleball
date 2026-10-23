"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Upload } from "lucide-react";
import { saveSettings } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { formatHour, canBook } from "@/lib/booking";
import type { VenueSettings } from "@/lib/types";

export function SettingsForm({ initial }: { initial: VenueSettings }) {
  const [venue, setVenue] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
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
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveSettings(venue);
      if (result.error) setError(result.error);
      else {
        setMessage("Settings saved. Your website is up to date.");
        router.refresh();
      }
    });
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
        <div className="field-grid">
          <label className="field">
            <span>Daytime court rate (PHP / hour)</span>
            <input
              type="number"
              min="1"
              max="100000"
              step="0.01"
              value={venue.hourly_rate ?? ""}
              placeholder="Not set yet"
              onChange={(e) =>
                update(
                  "hourly_rate",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="field">
            <span>Evening court rate (PHP / hour)</span>
            <input
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={venue.evening_hourly_rate}
              onChange={(e) =>
                update("evening_hourly_rate", Number(e.target.value))
              }
              required
            />
          </label>
          <label className="field">
            <span>Evening rate starts at</span>
            <select
              value={venue.evening_start_hour}
              onChange={(e) =>
                update("evening_start_hour", Number(e.target.value))
              }
            >
              {Array.from({ length: 23 }, (_, i) => (
                <option value={i + 1} key={i + 1}>
                  {formatHour(i + 1)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Equipment rental package (PHP)</span>
            <input
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={venue.equipment_rental_price}
              onChange={(e) =>
                update("equipment_rental_price", Number(e.target.value))
              }
              required
            />
            <small>
              1 paddle + 2 balls. Added once per reservation when selected.
            </small>
          </label>
          <label className="field">
            <span>Unpaid hold duration</span>
            <select
              value={venue.hold_minutes}
              onChange={(e) => update("hold_minutes", Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120].map((v) => (
                <option key={v} value={v}>
                  {v} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Opening time</span>
            <select
              value={venue.opening_hour ?? ""}
              onChange={(e) =>
                update(
                  "opening_hour",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Not set yet</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option value={i} key={i}>
                  {formatHour(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Closing time</span>
            <select
              value={venue.closing_hour ?? ""}
              onChange={(e) =>
                update(
                  "closing_hour",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Not set yet</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option value={i + 1} key={i + 1}>
                  {formatHour(i + 1)}
                  {i === 23 ? " (midnight)" : ""}
                </option>
              ))}
            </select>
          </label>
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
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <select
                value={venue[key]}
                onChange={(e) => update(key, Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) =>
                  key === "open_play_end_hour" ? i + 1 : i,
                ).map((hour) => (
                  <option value={hour} key={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="field">
            <span>Open-play pass (PHP / person)</span>
            <input
              type="number"
              value={venue.open_play_price}
              min="0.01"
              max="100000"
              step="0.01"
              onChange={(e) =>
                update("open_play_price", Number(e.target.value))
              }
              required
            />
          </label>
          <label className="field">
            <span>Player limit per weekend day (optional)</span>
            <input
              type="number"
              value={venue.open_play_capacity ?? ""}
              min="1"
              max="100000"
              placeholder="No limit"
              onChange={(e) =>
                update(
                  "open_play_capacity",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
            <small>Leave blank for no player limit across both courts.</small>
          </label>
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
            disabled={pending || uploading}
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
