"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Plus, X, Wallet } from "lucide-react";
import {
  addDays,
  formatDate,
  formatHour,
  localDate,
  money,
  courtScheduleLabel,
  hasOpenPlay,
  openPlayCapacityLabel,
  equipmentPackageLabel,
} from "@/lib/booking";
import { statusLabels, type Booking, type VenueSettings } from "@/lib/types";
import {
  staffCreateBooking,
  staffSetStatus,
  reserveOpenPlay,
} from "@/app/actions";
import { Modal } from "./modal";
import { paymentMethods } from "@/lib/finance";
import { EquipmentRental } from "./equipment-rental";
import { bookingPayments } from "@/lib/payment";
import { BalancePaymentModal } from "./balance-payment-modal";

export function AdminCalendar({
  bookings,
  date,
  venue,
}: {
  bookings: Booking[];
  date: string;
  venue: VenueSettings;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [balanceBooking, setBalanceBooking] = useState<Booking | null>(null);
  const [action, setAction] = useState<{
    booking: Booking;
    status: "confirmed" | "cancelled";
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const active = bookings.filter(
    (b) => !["cancelled", "expired"].includes(b.status),
  );
  const hours = Array.from(
    { length: (venue.closing_hour ?? 22) - (venue.opening_hour ?? 6) },
    (_, i) => i + (venue.opening_hour ?? 6),
  );
  function update() {
    if (!action) return;
    setError("");
    startTransition(async () => {
      const result = await staffSetStatus(action.booking.id, action.status);
      if (result.error) setError(result.error);
      else {
        setAction(null);
        router.refresh();
      }
    });
  }
  return (
    <>
      <div className="admin-header">
        <div>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 23,
              letterSpacing: "-.5px",
              margin: 0,
            }}
          >
            Court calendar
          </h2>
        </div>
        <button
          className="button button-dark button-small"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} />
          Add booking / block
        </button>
      </div>
      <div className="admin-stats">
        <div className="panel stat-card">
          <span>Active reservations</span>
          <strong>{active.filter((b) => b.status !== "blocked").length}</strong>
        </div>
        <div className="panel stat-card">
          <span>Payments to review</span>
          <strong>
            {active.filter((b) => b.status === "awaiting_verification").length}
          </strong>
        </div>
        <div className="panel stat-card">
          <span>Confirmed booking value</span>
          <strong>
            {money(
              active
                .filter((b) => b.status === "confirmed")
                .reduce((sum, b) => sum + Number(b.total_amount), 0),
            )}
          </strong>
        </div>
      </div>
      <div className="admin-toolbar">
        <h2>
          {formatDate(date, {
            weekday: "short",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <label className="field">
          <span>View date</span>
          <input
            type="date"
            value={date}
            min={addDays(localDate(), -365)}
            max={addDays(localDate(), 30)}
            onChange={(e) =>
              e.target.value && router.push(`/admin?date=${e.target.value}`)
            }
          />
        </label>
      </div>
      <div className="availability-grid" style={{ marginBottom: 28 }}>
        <div className="availability-header">
          <div>PHT / UTC+8</div>
          <div>Court 1</div>
          <div>Court 2</div>
        </div>
        {hours.map((hour) => (
          <div className="availability-row" key={hour}>
            <div className="time-label">{formatHour(hour)}</div>
            {[1, 2].map((court) => {
              const b = active.find(
                (b) =>
                  b.court_id === court &&
                  hour >= b.start_hour &&
                  hour < b.start_hour + b.duration,
              );
              return (
                <div className="slot-cell" key={court}>
                  {b ? (
                    <span
                      className={`status-badge status-${b.status}`}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        minHeight: 34,
                        borderRadius: 4,
                        fontSize: 14,
                      }}
                    >
                      {b.status === "blocked"
                        ? b.customer_name
                        : `${b.customer_name} · ${statusLabels[b.status]}`}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: 34,
                        fontSize: 14,
                        color: "var(--muted)",
                      }}
                    >
                      {courtScheduleLabel(venue, date, hour) || "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {hasOpenPlay(venue, date) && (
        <div className="notice" style={{ marginBottom: 24 }}>
          <span>
            <strong>
              Weekend open play · {formatHour(venue.open_play_start_hour)}–
              {formatHour(venue.open_play_end_hour)}
            </strong>
            <br />
            {active
              .filter((b) => b.booking_type === "open_play")
              .reduce((sum, b) => sum + b.participant_count, 0)}{" "}
            players held or confirmed · {money(venue.open_play_price)} per
            person · {openPlayCapacityLabel(venue.open_play_capacity)}
          </span>
        </div>
      )}
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "22px 24px" }}>
          <h3 style={{ fontSize: 17, margin: 0 }}>
            Reservations & payment review
          </h3>
          <p className="small-print">
            Check incoming transactions in GCash before confirming. Cancelling a
            paid booking does not issue a refund.
          </p>
        </div>
        {!bookings.length ? (
          <div className="empty-state" style={{ border: 0 }}>
            <CalendarDays />
            <h2>A clear court, a fresh start.</h2>
            <p>No reservations for this date.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Player / reference</th>
                  <th>Court & time</th>
                  <th>Amount</th>
                  <th>GCash reference</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.customer_name}</strong>
                      <small>
                        {b.reference}
                        {b.customer_phone && (
                          <>
                            {" "}
                            ·{" "}
                            <a href={`tel:${b.customer_phone}`}>
                              {b.customer_phone}
                            </a>
                          </>
                        )}
                      </small>
                    </td>
                    <td>
                      {b.booking_type === "open_play"
                        ? `Open play · ${b.participant_count} ${b.participant_count === 1 ? "player" : "players"}`
                        : `Court ${b.court_id}`}
                      <small>
                        {formatHour(b.start_hour)} –{" "}
                        {formatHour(b.start_hour + b.duration)}
                      </small>
                      {b.equipment_rental && (
                        <small>
                          Equipment:{" "}
                          {equipmentPackageLabel(b.equipment_ball_count ?? 2)} ·{" "}
                          {money(b.equipment_amount)}
                        </small>
                      )}
                    </td>
                    <td>
                      {money(b.total_amount)}
                      {b.status !== "blocked" && (
                        <>
                          <small>
                            {b.payment_option === "reservation_fee"
                              ? "50% reservation fee"
                              : "Full payment"}
                          </small>
                          <small>Paid: {money(bookingPayments(b).paid)}</small>
                          {b.status === "confirmed" ? (
                            <small>
                              {bookingPayments(b).balance > 0
                                ? `Balance: ${money(bookingPayments(b).balance)}`
                                : "Fully paid"}
                            </small>
                          ) : (
                            [
                              "awaiting_payment",
                              "awaiting_verification",
                            ].includes(b.status) && (
                              <small>
                                Due now: {money(bookingPayments(b).initial)}
                              </small>
                            )
                          )}
                        </>
                      )}
                    </td>
                    <td>{b.payment_reference || "—"}</td>
                    <td>
                      <span className={`status-badge status-${b.status}`}>
                        {statusLabels[b.status]}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {b.status === "confirmed" &&
                          bookingPayments(b).balance > 0 && (
                            <button
                              aria-label={`Record balance for ${b.reference}`}
                              title="Record balance payment"
                              onClick={() => setBalanceBooking(b)}
                            >
                              <Wallet size={16} />
                            </button>
                          )}
                        {["awaiting_payment", "awaiting_verification"].includes(
                          b.status,
                        ) && (
                          <button
                            aria-label={`Confirm ${b.reference}`}
                            title="Confirm after verifying payment"
                            onClick={() => {
                              setAction({ booking: b, status: "confirmed" });
                              setError("");
                            }}
                          >
                            <Check size={15} />
                          </button>
                        )}
                        {!["cancelled", "expired"].includes(b.status) && (
                          <button
                            className="danger"
                            aria-label={`Cancel ${b.reference}`}
                            title="Cancel / release court"
                            onClick={() => {
                              setAction({ booking: b, status: "cancelled" });
                              setError("");
                            }}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {createOpen && (
        <CreateBookingModal
          date={date}
          venue={venue}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {balanceBooking && (
        <BalancePaymentModal
          booking={balanceBooking}
          onClose={() => setBalanceBooking(null)}
        />
      )}
      {action && (
        <Modal
          title={
            action.status === "confirmed"
              ? "Verify & confirm reservation"
              : "Cancel this reservation?"
          }
          onClose={() => !pending && setAction(null)}
        >
          <p style={{ fontSize: 14, lineHeight: 1.8 }}>
            <strong>
              {action.booking.reference} · {action.booking.customer_name}
            </strong>
            <br />
            {action.booking.booking_type === "open_play"
              ? `Open play · ${action.booking.participant_count} players`
              : `Court ${action.booking.court_id}`}{" "}
            · {formatHour(action.booking.start_hour)} ·{" "}
            {money(action.booking.total_amount)}
          </p>
          {action.status === "confirmed" && (
            <p>
              <strong>
                Verify {money(bookingPayments(action.booking).initial)}
              </strong>
              {action.booking.payment_option === "reservation_fee"
                ? ` reservation fee. Balance at venue: ${money(bookingPayments(action.booking).later)}.`
                : " full payment."}
            </p>
          )}
          <div className="notice notice-warning">
            <span>
              {action.status === "confirmed"
                ? "Confirm only after you have checked that the payment reached your GCash account. A submitted reference alone is not payment verification."
                : "This releases the court. If the customer already paid, arrange any refund directly through GCash according to your policy. This website will not send money."}
            </span>
          </div>
          {error && (
            <div
              className="error-message"
              style={{ marginTop: 15 }}
              role="alert"
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <button
              className="button button-dark"
              onClick={update}
              disabled={pending}
            >
              {pending
                ? "Updating…"
                : action.status === "confirmed"
                  ? "Payment checked — confirm"
                  : "Cancel reservation"}
            </button>
            <button
              className="button button-outline"
              onClick={() => setAction(null)}
              disabled={pending}
            >
              Go back
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreateBookingModal({
  date,
  venue,
  onClose,
}: {
  date: string;
  venue: VenueSettings;
  onClose: () => void;
}) {
  const [blocked, setBlocked] = useState(false);
  const [openPlay, setOpenPlay] = useState(false);
  const [equipmentRental, setEquipmentRental] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const input = {
      ...Object.fromEntries(form.entries()),
      equipment_rental: form.get("equipment_rental") === "on",
    };
    startTransition(async () => {
      const result = openPlay
        ? await reserveOpenPlay(input, true)
        : await staffCreateBooking(input, blocked);
      if (result.error) setError(result.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }
  return (
    <Modal title="Add court time" onClose={() => !pending && onClose()}>
      <form onSubmit={submit} className="form-stack">
        <label className="field">
          <span>Reservation type</span>
          <select
            value={openPlay ? "open_play" : "court"}
            onChange={(e) => {
              setOpenPlay(e.target.value === "open_play");
              setBlocked(false);
            }}
          >
            <option value="court">Court booking / block</option>
            <option value="open_play">Confirmed open-play passes</option>
          </select>
        </label>
        {!openPlay && (
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => setBlocked(e.target.checked)}
            />
            <span>
              <strong>Block court for maintenance or an event</strong>
              <small>Leave off for a confirmed walk-in reservation.</small>
            </span>
          </label>
        )}
        <div className="field-grid">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              name="booking_date"
              defaultValue={date < localDate() ? localDate() : date}
              min={localDate()}
              max={addDays(localDate(), 30)}
              required
            />
          </label>
          {!openPlay && (
            <label className="field">
              <span>Court</span>
              <select name="court_id">
                <option value="1">Court 1</option>
                <option value="2">Court 2</option>
              </select>
            </label>
          )}
          {openPlay ? (
            <label className="field">
              <span>Number of players</span>
              <input
                type="number"
                name="participant_count"
                min="1"
                max="20"
                defaultValue="1"
                required
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Start time</span>
                <select name="start_hour">
                  {Array.from(
                    {
                      length:
                        (venue.closing_hour ?? 22) - (venue.opening_hour ?? 6),
                    },
                    (_, i) => i + (venue.opening_hour ?? 6),
                  ).map((h) => (
                    <option value={h} key={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Duration</span>
                <select name="duration">
                  {[1, 2, 3, 4].map((d) => (
                    <option value={d} key={d}>
                      {d} {d === 1 ? "hour" : "hours"}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <label className="field">
          <span>{blocked ? "Block reason" : "Customer name"}</span>
          <input
            name="customer_name"
            required
            minLength={2}
            maxLength={100}
            placeholder={blocked ? "e.g. Court maintenance" : "Full name"}
          />
        </label>
        {!blocked && (
          <label className="field">
            <span>Customer mobile</span>
            <input
              name="customer_phone"
              type="tel"
              required
              placeholder="09171234567"
            />
          </label>
        )}
        {!blocked && (
          <>
            <EquipmentRental
              price={venue.equipment_rental_price}
              ballCount={venue.equipment_ball_count}
              checked={equipmentRental}
              onChange={setEquipmentRental}
              disabled={pending}
            />
            <label className="field">
              <span>Payment collected</span>
              <select name="payment_option" defaultValue="full">
                <option value="full">Full payment</option>
                <option value="reservation_fee">50% reservation fee</option>
              </select>
              <small>
                Choose the amount already collected. Any remaining balance is
                due before play.
              </small>
            </label>
            <label className="field">
              <span>Payment received via</span>
              <select name="payment_method" defaultValue="cash">
                {Object.entries(paymentMethods)
                  .filter(([key]) => key !== "unspecified")
                  .map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Staff notes (optional)</span>
              <textarea name="finance_notes" rows={2} maxLength={2000} />
            </label>
          </>
        )}
        {!blocked && !openPlay && (
          <p className="small-print">
            Walk-ins are saved as confirmed reservations. Record these only
            after collecting payment. Court rates:{" "}
            {money(venue.hourly_rate ?? 0)}/hour before{" "}
            {formatHour(venue.evening_start_hour)}, then{" "}
            {money(venue.evening_hourly_rate)}/hour. The total is calculated for
            the selected hours. Selected equipment adds{" "}
            {money(venue.equipment_rental_price)} once per booking.
          </p>
        )}
        {openPlay && (
          <p className="small-print">
            Saturday and Sunday, {formatHour(venue.open_play_start_hour)}–
            {formatHour(venue.open_play_end_hour)}.{" "}
            {money(venue.open_play_price)} per player. Record passes only after
            collecting payment, including any selected equipment rental. The
            session must be available on both courts.
          </p>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        <button className="button button-dark" disabled={pending}>
          {pending
            ? "Saving…"
            : blocked
              ? "Block court time"
              : openPlay
                ? "Add confirmed open-play passes"
                : "Add confirmed walk-in"}
        </button>
      </form>
    </Modal>
  );
}
