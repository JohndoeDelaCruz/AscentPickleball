"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, RefreshCw } from "lucide-react";
import { reserveOpenPlay } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatHour,
  hasOpenPlay,
  isPastSlot,
  money,
  canBook,
  calculateReservationTotal,
  openPlayCapacityLabel,
} from "@/lib/booking";
import type {
  OpenPlayAvailability,
  PaymentOption,
  VenueSettings,
} from "@/lib/types";
import { EquipmentRental } from "./equipment-rental";
import { PaymentOptions } from "./payment-options";

export function OpenPlayBooking({
  venue,
  date,
  ready,
  signedIn,
  userName,
}: {
  venue: VenueSettings;
  date: string;
  ready: boolean;
  signedIn: boolean;
  userName: string;
}) {
  const [people, setPeople] = useState(1);
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState("");
  const [equipmentRental, setEquipmentRental] = useState(false);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");
  const [accepted, setAccepted] = useState(false);
  const [availability, setAvailability] = useState<OpenPlayAvailability | null>(
    null,
  );
  const [loading, setLoading] = useState(ready);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scheduled = hasOpenPlay(venue, date);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setAvailability(null);
    setLoadError("");
    setLoading(ready && scheduled);
    if (!ready || !scheduled) return;
    const client = createClient();
    async function refresh() {
      const { data, error } = await client.rpc("get_open_play_availability", {
        p_date: date,
      });
      if (!active) return;
      setLoading(false);
      if (error) {
        setLoadError(
          "We couldn’t load open-play availability. Please refresh before reserving.",
        );
        return;
      }
      setLoadError("");
      setAvailability(data?.[0] || null);
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [date, ready, scheduled, revision]);
  useEffect(() => {
    setError("");
  }, [date]);
  const ended = isPastSlot(date, venue.open_play_end_hour, now);
  const canReserve =
    ready &&
    scheduled &&
    canBook(venue) &&
    availability?.enabled &&
    !availability.conflict &&
    !ended;
  const remaining = availability?.remaining;
  const tooMany =
    remaining !== null && remaining !== undefined && people > remaining;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canReserve || !accepted || tooMany) return;
    setError("");
    startTransition(async () => {
      const result = await reserveOpenPlay({
        booking_date: date,
        participant_count: people,
        customer_name: name,
        customer_phone: phone,
        equipment_rental: equipmentRental,
        payment_option: paymentOption,
      });
      if (result.error) {
        setError(result.error);
        setRevision((v) => v + 1);
      } else if (result.id) router.push(`/booking/${result.id}`);
    });
  }
  return (
    <section className="panel open-play-panel" aria-label="Weekend open play">
      <div className="open-play-heading">
        <span className="open-play-icon">
          <Users size={24} />
        </span>
        <div>
          <span className="eyebrow">SHARE THE COURT</span>
          <h2>Weekend open play</h2>
        </div>
        <strong className="open-play-price">
          {money(venue.open_play_price)}
          <small>/ person</small>
        </strong>
      </div>
      <p>
        Come for a few rallies or stay for the session. Your pass covers{" "}
        {formatHour(venue.open_play_start_hour)}–
        {formatHour(venue.open_play_end_hour)}.
      </p>
      <p>
        <strong>{openPlayCapacityLabel(venue.open_play_capacity)}.</strong>{" "}
        Players share both courts and rotate between games.
      </p>
      <div className="open-play-meta">
        <span>
          {formatDate(date, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
        <span>
          {venue.open_play_capacity === null
            ? "No player limit"
            : `${remaining ?? venue.open_play_capacity} places remaining`}
        </span>
      </div>
      {!scheduled ? (
        <div className="notice">
          Open play runs on Saturdays and Sundays. Choose a weekend date above.
        </div>
      ) : (
        <>
          {availability?.conflict && (
            <div className="notice notice-warning">
              Open play is unavailable on this date because a court is reserved
              or blocked. Choose another weekend.
            </div>
          )}
          {ended && (
            <div className="notice">
              This open-play session has ended. Choose another weekend date.
            </div>
          )}
          {(!ready || !venue.booking_enabled) && (
            <div className="notice">
              Online open-play reservations are opening soon. You can preview
              the session details here.
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          {loadError && (
            <div className="error-message" role="alert">
              {loadError}
              <button
                type="button"
                className="text-link"
                onClick={() => setRevision((v) => v + 1)}
              >
                <RefreshCw size={12} /> Refresh availability
              </button>
            </div>
          )}
          {!signedIn ? (
            <Link
              className="button button-dark"
              href={`/login?next=${encodeURIComponent(`/book?play=open&date=${date}`)}`}
            >
              Sign in for open play <ArrowRight size={16} />
            </Link>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              <div className="field-grid">
                <label className="field">
                  <span>Number of players</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={people}
                    onChange={(e) => setPeople(Number(e.target.value))}
                    required
                  />
                  <small>
                    Up to 20 players per reservation. Each player needs a pass.
                  </small>
                </label>
                <label className="field">
                  <span>Full name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              </div>
              <label className="field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="09171234567"
                  required
                />
              </label>
              <EquipmentRental
                price={venue.equipment_rental_price}
                ballCount={venue.equipment_ball_count}
                checked={equipmentRental}
                onChange={setEquipmentRental}
                disabled={pending}
              />
              <dl className="summary-rows equipment-cost-rows">
                <div>
                  <dt>
                    {people || 0} {people === 1 ? "player" : "players"} ×{" "}
                    {money(venue.open_play_price)}
                  </dt>
                  <dd>{money((people || 0) * venue.open_play_price)}</dd>
                </div>
                <div>
                  <dt>Equipment rental</dt>
                  <dd>
                    {money(equipmentRental ? venue.equipment_rental_price : 0)}
                  </dd>
                </div>
              </dl>
              <div className="summary-total">
                <span>Booking total</span>
                <strong>
                  {money(
                    calculateReservationTotal(
                      (people || 0) * venue.open_play_price,
                      venue.equipment_rental_price,
                      equipmentRental,
                    ),
                  )}
                </strong>
              </div>
              <PaymentOptions
                total={calculateReservationTotal(
                  (people || 0) * venue.open_play_price,
                  venue.equipment_rental_price,
                  equipmentRental,
                )}
                value={paymentOption}
                onChange={setPaymentOption}
                disabled={pending}
              />
              {tooMany && (
                <div className="notice notice-warning">
                  There are not enough places for this group. Choose fewer
                  players or another date.
                </div>
              )}
              <label className="open-play-agreement">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  required
                />
                <span>
                  I agree to the booking policy and{" "}
                  <Link
                    href="/court-rules"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="policy-link"
                  >
                    court rules
                  </Link>
                  , and understand that open play uses shared courts with player
                  rotation.
                </span>
              </label>
              <button
                className="button button-dark"
                disabled={
                  !canReserve ||
                  tooMany ||
                  loading ||
                  pending ||
                  !accepted ||
                  Boolean(loadError)
                }
              >
                {pending
                  ? "Reserving…"
                  : loading
                    ? "Checking availability…"
                    : "Reserve passes & view GCash QR"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          <p className="small-print">
            Pay through the venue’s GCash QR and submit your reference. Staff
            confirms after checking payment. Selected equipment rental is
            included in your total. {venue.cancellation_policy}
          </p>
        </>
      )}
    </section>
  );
}
