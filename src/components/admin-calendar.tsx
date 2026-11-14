"use client";
import { WorkspacePageHeading } from "./workspace-page-heading";
import type { CSSProperties } from "react";
import { activeCourts, calendarCourts, courtName, defaultCourts } from "@/lib/courts";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Check, Plus, X, Wallet } from "lucide-react";
import {
  addDays,
  formatDate,
  formatHour,
  localDate,
  money,
  courtScheduleLabel,
  openPlayCapacityLabel,
  equipmentBookingLabel,
} from "@/lib/booking";
import { bookingStatusLabel, type CalendarBooking, type VenueSettings } from "@/lib/types";
import { staffSetStatus } from "@/app/actions";
import { Modal } from "./modal";
import { useAnimatedModal } from "./use-animated-modal";
import { bookingPayments } from "@/lib/payment";
import { BalancePaymentModal } from "./balance-payment-modal";
import { resolveSchedule, scheduleHours } from "@/lib/schedule";
import { TablePagination, useTablePage } from "./table-pagination";
import { CreateBookingModal } from "./create-booking-modal";
import { RegisterControl, RegisterDay } from "./register-day";
import type { RegisterDay as RegisterData } from "@/lib/register";

export function AdminCalendar({
  bookings,
  date,
  venue,
  manager,
  register,
  canAssign,
  operator,
}: {
  bookings: CalendarBooking[];
  date: string;
  venue: VenueSettings;
  manager: boolean;
  register: RegisterData | null;
  canAssign: boolean;
  operator: string;
}) {
  const [createOpen, setCreateOpen, createClosing] = useAnimatedModal<true>();
  const courts = calendarCourts(venue.courts ?? defaultCourts, bookings);
  const [balanceBooking, setBalanceBooking, balanceClosing] = useAnimatedModal<CalendarBooking>();
  const [action, setAction, actionClosing] = useAnimatedModal<{
    booking: CalendarBooking;
    status: "confirmed" | "cancelled";
  }>();
  const [error, setError] = useState("");
  const [walkInSaved, setWalkInSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const reservations = useTablePage(bookings.length, date);
  const router = useRouter();
  const active = bookings.filter(
    (b) => !["cancelled", "expired"].includes(b.status),
  );
  const schedule = resolveSchedule(venue, date);
  const sessions = schedule.blocks.filter(
    (block) => block.kind === "open_play",
  );
  const hours = [
    ...new Set([
      ...scheduleHours(schedule.blocks),
      ...active.flatMap((b) =>
        Array.from({ length: b.duration }, (_, i) => b.start_hour + i),
      ),
    ]),
  ].sort((a, b) => a - b);
  const courtHours = useTablePage(hours.length, date);

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
      <WorkspacePageHeading title="Court calendar" actions={
        <button
          className="button button-dark button-small"
          onClick={() => {
            setWalkInSaved(false);
            setCreateOpen(true);
          }}
        >
          <Plus size={16} />
          {manager ? "Add booking or block" : "Add walk-in"}
        </button>
      } />
      {register && <RegisterControl data={register} shift={register.active?.own_shift ?? undefined} operator={operator} ready />}
      {walkInSaved && <p className="success-message" role="status">Walk-in booking saved.</p>}
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
          <Link className="text-link" href="/staff?tab=bookings&review=1">
            Open GCash review queue
          </Link>
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
      {register && <RegisterDay key={date} data={register} date={date} manager={canAssign} />}
      {schedule.override && (
        <div className="notice" style={{ marginBottom: 20 }}>
          {schedule.override.name} · through{" "}
          {formatDate(schedule.override.end_date)}. Regular hours resume{" "}
          {formatDate(addDays(schedule.override.end_date, 1))}.
        </div>
      )}
      {!hours.length && (
        <div className="notice" style={{ marginBottom: 20 }}>
          No scheduled court time on this date.
        </div>
      )}
      <div style={{ marginBottom: 28 }}>
      <div id="calendar-court-slots" tabIndex={-1} role="region" aria-label="Court calendar time slots"
        className="availability-grid dynamic-court-grid" style={{ "--court-columns": Math.max(1, courts.length) } as CSSProperties}>
        <div className="availability-header">
          <div>PHT / UTC+8</div>
          {courts.map((court) => <div key={court.id}>{court.name}{!court.active && " · Inactive"}</div>)}
        </div>
        {hours.slice(courtHours.start, courtHours.end).map((hour) => (
          <div className="availability-row" key={hour}>
            <div className="time-label">{formatHour(hour)}</div>
            {courts.map(({ id: court }) => {
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
                        : `${b.customer_name} · ${bookingStatusLabel(b)}`}
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
        <TablePagination {...courtHours} label="Court calendar time slot pages" anchorId="calendar-court-slots" />
      </div>
      {sessions.map((session) => (
        <div className="notice" style={{ marginBottom: 24 }} key={session.id}>
          <span>
            <strong>
              Open play · {formatHour(session.start)}–{formatHour(session.end)}
            </strong>
            <br />
            {active
              .filter(
                (b) =>
                  b.booking_type === "open_play" &&
                  b.start_hour === session.start &&
                  b.duration === session.end - session.start,
              )
              .reduce((sum, b) => sum + b.participant_count, 0)}{" "}
            players held or confirmed · {money(session.rate)} per person ·{" "}
            {openPlayCapacityLabel(session.capacity, activeCourts(venue.courts).length)}
          </span>
        </div>
      ))}
      <section className="panel" aria-labelledby="calendar-reservation-review" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "22px 24px" }}>
          <h3 id="calendar-reservation-review" tabIndex={-1} style={{ fontSize: 17, margin: 0 }}>
            Reservations & payment review
          </h3>
          <p className="small-print">
            {manager
              ? "Check incoming transactions in GCash before confirming. Cancelling a paid booking does not issue a refund."
              : <Link className="text-link" href={`/staff?tab=bookings&date=${date}`}>Review payments and collect balances in Reservations</Link>}
          </p>
        </div>
        {!bookings.length ? (
          <div className="empty-state" style={{ border: 0 }}>
            <CalendarDays />
            <h2>No reservations</h2>
            <p>There are no bookings for this date.</p>
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
                  {manager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bookings.slice(reservations.start, reservations.end).map((b) => (
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
                        : courtName(venue.courts, b.court_id)}
                      <small>
                        {formatHour(b.start_hour)} –{" "}
                        {formatHour(b.start_hour + b.duration)}
                      </small>
                      {b.equipment_rental && (
                        <small>
                          Equipment: {equipmentBookingLabel(b)} ·{" "}
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
                        {bookingStatusLabel(b)}
                      </span>
                    </td>
                    {manager && <td>
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
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination {...reservations} label="Reservation pages" anchorId="calendar-reservation-review" />
      </section>
      {createOpen && (
        <CreateBookingModal
          date={date}
          venue={venue}
          manager={manager}
          onClose={() => setCreateOpen(null)}
          onWalkInSaved={() => setWalkInSaved(true)}
          closing={createClosing}
        />
      )}
      {balanceBooking && (
        <BalancePaymentModal
          booking={balanceBooking}
          onClose={() => setBalanceBooking(null)}
          closing={balanceClosing}
        />
      )}
      {action && (
        <Modal
          closing={actionClosing}
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
