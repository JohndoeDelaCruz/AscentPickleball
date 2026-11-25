"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
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
} from "@/lib/booking";
import type {
  OpenPlayAvailability,
  PaymentOption,
  VenueSettings,
} from "@/lib/types";
import { EquipmentRental } from "./equipment-rental";
import { PaymentOptions } from "./payment-options";
import { BookingBar, BookingPolicy, BookingReviewHeading } from "./booking-checkout";
import styles from "./booking-calendar.module.css";
import { resolveSchedule } from "@/lib/schedule";

export function OpenPlayBooking({
  venue,
  date,
  ready,
  signedIn,
  userName,
  selectedStart,
  onSessionChange,
  initialPlayers,
  reviewing,
  onReviewChange,
}: {
  venue: VenueSettings;
  date: string;
  ready: boolean;
  signedIn: boolean;
  userName: string;
  selectedStart: number | null;
  onSessionChange: (start: number) => void;
  initialPlayers?: number;
  reviewing: boolean;
  onReviewChange: (review: boolean) => void;
}) {
  const [people, setPeople] = useState(initialPlayers && initialPlayers >= 1 && initialPlayers <= 20 ? initialPlayers : 1);
  const [selectedForReview, setSelectedForReview] = useState<string | null>(
    reviewing && selectedStart !== null ? `${date}:${selectedStart}` : null,
  );
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState("");
  const [requestedEquipmentQuantity, setEquipmentQuantity] = useState(0);
  const equipmentLimit = Math.max(0, Math.min(20, Math.floor(people) || 0));
  const equipmentQuantity = Math.min(
    requestedEquipmentQuantity,
    equipmentLimit,
  );
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");
  const [accepted, setAccepted] = useState(false);
  const [availability, setAvailability] = useState<
    OpenPlayAvailability[] | null
  >(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(ready);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [memberQuote, setMemberQuote] = useState<{ key: string; discountCents: number | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const sessionApiReady = "schedule_config" in venue;
  const previewSessions = resolveSchedule(venue, date)
    .blocks.filter((b) => b.kind === "open_play")
    .map((b) => ({
      enabled: false,
      start_hour: b.start,
      end_hour: b.end,
      price: b.rate,
      capacity: b.capacity,
      players: 0,
      remaining: b.capacity,
      conflict: false,
    }));
  const sessions =
    loadedDate === date && availability ? availability : previewSessions;
  const chosen = sessions.find((session) => session.start_hour === selectedStart) ??
    (reviewing ? undefined : (sessions.find((session) => !isPastSlot(date, session.end_hour, now)) ?? sessions[0]));
  const activeSession = chosen ?? {
    enabled: false,
    start_hour: 0,
    end_hour: 0,
    price: 0,
    capacity: 0,
    players: 0,
    remaining: 0,
    conflict: false,
  };
  const scheduled = Boolean(chosen);
  useEffect(() => {
    if (chosen) onSessionChange(chosen.start_hour);
    setAccepted(false);
    setError("");
  }, [date, chosen?.start_hour, onSessionChange]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setAvailability(null);
    setLoadError("");
    const shouldLoad = ready && (sessionApiReady || hasOpenPlay(venue, date));
    setLoading(shouldLoad);
    if (!shouldLoad) return;
    const client = createClient();
    async function refresh() {
      const { data, error } = await client.rpc(
        sessionApiReady
          ? "get_open_play_sessions"
          : "get_open_play_availability",
        {
          p_date: date,
        },
      );
      if (!active) return;
      setLoading(false);
      if (error) {
        setLoadError(
          "We couldn’t load open-play availability. Please refresh before reserving.",
        );
        return;
      }
      setLoadError("");
      setAvailability(
        (data || []).map((s: OpenPlayAvailability) => ({
          ...s,
          price: Number(s.price),
        })),
      );
      setLoadedDate(date);
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [date, ready, sessionApiReady, revision]);
  useEffect(() => {
    setError("");
  }, [date]);
  const ended = isPastSlot(date, activeSession.end_hour, now);
  const canReserve =
    ready &&
    scheduled &&
    canBook(venue) &&
    activeSession.enabled &&
    !activeSession.conflict &&
    !ended;
  const remaining = activeSession.remaining;
  const tooMany =
    remaining !== null && remaining !== undefined && people > remaining;
  const validPeople = Number.isInteger(people) && people >= 1 && people <= 20;
  const start = activeSession.start_hour;
  const price = activeSession.price;
  const quoteKey = signedIn && canReserve ? `${date}:${start}:${price}:${revision}` : null;
  const quoteFailed = quoteKey !== null && memberQuote?.key === quoteKey && memberQuote.discountCents === null;
  const checkingPrice = quoteKey !== null && memberQuote?.key !== quoteKey;
  const discountCents = people >= 1 && memberQuote?.key === quoteKey ? memberQuote.discountCents ?? 0 : 0;
  const regularTotal = calculateReservationTotal((people || 0) * price, venue.equipment_rental_price, equipmentQuantity);
  const totalCents = Math.round(regularTotal * 100) - discountCents;
  const time = `${formatHour(start)}–${formatHour(activeSession.end_hour)}`;
  const passSelection = `${date}:${start}`;
  const reservationReady = canReserve && validPeople && !tooMany && !loading && !loadError;
  const displayedTotal = checkingPrice ? "Checking price…" : quoteFailed ? "Price unavailable" : money(totalCents / 100);

  useEffect(() => {
    if (!quoteKey) return;
    let active = true;
    async function loadPrice() {
      const { data, error } = await createClient().rpc("get_open_play_member_discount", { p_date: date, p_start: start });
      if (!active || !quoteKey) return;
      const discount = error?.code === "PGRST202" ? 0
        : !error && Number.isInteger(data) && data >= 0 && data <= Math.round(price * 100) ? data : null;
      setMemberQuote({ key: quoteKey, discountCents: discount });
    }
    loadPrice().catch(() => {
      if (active) setMemberQuote({ key: quoteKey, discountCents: null });
    });
    return () => { active = false; };
  }, [date, start, price, quoteKey]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewing || !signedIn || !reservationReady || !accepted || checkingPrice || quoteFailed) return;
    setError("");
    startTransition(async () => {
      const result = await reserveOpenPlay({
        booking_date: date,
        start_hour: activeSession.start_hour,
        participant_count: people,
        customer_name: name,
        customer_phone: phone,
        equipment_rental: equipmentQuantity > 0,
        equipment_quantity: equipmentQuantity,
        payment_option: paymentOption,
        expected_total_cents: totalCents,
      });
      if (result.error) {
        setError(result.error);
        setRevision((v) => v + 1);
      } else if (result.id) router.push(`/booking/${result.id}`);
    });
  }
  const availabilityError = loadError && (
    <div className="error-message" role="alert">
      {loadError}{" "}
      <button type="button" className="button button-small button-outline" onClick={() => setRevision((value) => value + 1)}>
        Retry
      </button>
    </div>
  );
  const priceError = quoteFailed && (
    <div className="error-message" role="alert">
      We couldn’t check the member price.{" "}
      <button type="button" className="button button-small button-outline" onClick={() => setRevision((value) => value + 1)}>
        Check price again
      </button>
    </div>
  );

  if (!reviewing) {
    return (
      <section className={styles.availability} aria-labelledby="open-play-availability">
        <div className={styles.sectionHeading}>
          <h2 id="open-play-availability" data-booking-availability-heading tabIndex={-1}>Open-play sessions</h2>
          <span>Philippine time</span>
        </div>
        {availabilityError}
        {priceError}
        {sessions.length > 0 ? (
          <div className={styles.openSessions} role="group" aria-label="Open-play session">
            {sessions.map((session) => (
              <button key={session.start_hour} type="button"
                aria-pressed={activeSession.start_hour === session.start_hour}
                onClick={() => onSessionChange(session.start_hour)}>
                <strong>{formatHour(session.start_hour)}–{formatHour(session.end_hour)}</strong>
                <span>{money(session.price)} / person</span>
                <small>{isPastSlot(date, session.end_hour, now) ? "Session ended"
                  : session.conflict ? "Courts unavailable"
                  : loading && loadedDate !== date ? "Checking availability…"
                  : session.capacity === null ? "No player limit"
                  : `${session.remaining ?? session.capacity} places remaining`}</small>
              </button>
            ))}
          </div>
        ) : !loadError && (
          <div className={styles.sessionCard}>
            <p>{loading ? "Checking sessions…" : "No open-play sessions are scheduled for this date. Choose another date or book a private court."}</p>
          </div>
        )}
        {scheduled && (
          <>
            <div className={styles.sessionControls}>
              <label className={`field ${styles.playersField}`}>
                <span>Number of players</span>
                <input type="number" min="1" max="20" value={people}
                  onChange={(event) => setPeople(Number(event.target.value))} required />
              </label>
              {selectedForReview !== passSelection && (
                <button type="button" className="button button-outline" disabled={!reservationReady}
                  onClick={() => setSelectedForReview(passSelection)}>
                  Select session
                </button>
              )}
            </div>
            {tooMany && <p className={styles.availabilityStatus} role="status">Choose fewer players or another session.</p>}
            {!validPeople && <p className={styles.availabilityStatus} role="status">Choose 1 to 20 players.</p>}
            {selectedForReview === passSelection && (
              <BookingBar total={displayedTotal}
                selection={`Open play · ${people} ${people === 1 ? "player" : "players"} · ${time}`}
                disabled={!reservationReady || checkingPrice || quoteFailed} onContinue={() => onReviewChange(true)} />
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section className={styles.review} aria-label="Open-play booking review">
      <BookingReviewHeading onBack={() => onReviewChange(false)} disabled={pending} />
      <div className={`panel ${styles.reviewPanel}`}>
        {availabilityError}
        {priceError}
        {!scheduled ? (
          !loadError && <p role="status">{loading ? "Checking sessions…" : "This session is no longer available. Go back to choose another session."}</p>
        ) : (
          <>
            <dl className="summary-rows">
              <div><dt>Session</dt><dd>{time}</dd></div>
              <div><dt>Date</dt><dd>{formatDate(date, { weekday: "long", month: "short", day: "numeric" })}</dd></div>
              <div><dt>Players</dt><dd>{people}</dd></div>
              {!signedIn && <div><dt>Booking total</dt><dd><strong>{displayedTotal}</strong></dd></div>}
            </dl>
            <p className="small-print">Each pass covers one player for the session. Players share the courts and rotate between games.</p>
            {activeSession.conflict && (
              <div className="notice notice-warning" role="status">A court was reserved or blocked. Go back to choose another session.</div>
            )}
            {ended && <div className="notice" role="status">This open-play session has ended.</div>}
            {tooMany && <div className="notice notice-warning" role="status">There are fewer places available now. Go back to change your group size.</div>}
            {(!ready || !venue.booking_enabled) && <div className="notice">Online open-play reservations are opening soon.</div>}
            {error && <div className="error-message" role="alert">{error}</div>}
            {!signedIn ? (
              <Link className="button button-dark"
                href={`/login?next=${encodeURIComponent(`/book?play=open&date=${date}&session=${start}&players=${people}&review=1`)}`}>
                Sign in for open play <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <form className="form-stack" onSubmit={submit}>
                <div className="field-grid">
                  <label className="field">
                    <span>Full name</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"
                      required minLength={2} maxLength={100} />
                  </label>
                  <label className="field">
                    <span>Mobile number</span>
                    <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel" placeholder="09171234567" required />
                  </label>
                </div>
                <EquipmentRental price={venue.equipment_rental_price} ballCount={venue.equipment_ball_count}
                  quantity={equipmentQuantity} maxQuantity={equipmentLimit} onChange={setEquipmentQuantity} disabled={pending} />
                <dl className="summary-rows equipment-cost-rows">
                  <div>
                    <dt>{people} {people === 1 ? "player" : "players"} × {money(price)}</dt>
                    <dd>{money(people * price)}</dd>
                  </div>
                  {discountCents > 0 && (
                    <div><dt>Membership discount · 1 pass</dt><dd>−{money(discountCents / 100)}</dd></div>
                  )}
                  <div><dt>Equipment rental</dt><dd>{money(equipmentQuantity * venue.equipment_rental_price)}</dd></div>
                </dl>
                <div className="summary-total"><span>Booking total</span><strong>{displayedTotal}</strong></div>
                {!checkingPrice && !quoteFailed && (
                  <PaymentOptions total={totalCents / 100} value={paymentOption} onChange={setPaymentOption} disabled={pending} />
                )}
                <label className="open-play-agreement">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
                  <span>
                    I agree to the <a href="#open-play-policy" className="policy-link">booking and cancellation policy</a> and{" "}
                    <Link href="/court-rules" target="_blank" rel="noopener noreferrer" className="policy-link">court rules</Link>,
                    and understand that players share the courts and rotate between games.
                  </span>
                </label>
                <button className="button button-dark" disabled={
                  !reservationReady || checkingPrice || quoteFailed || pending || !accepted
                }>
                  {pending ? "Reserving…" : loading ? "Checking availability…"
                    : checkingPrice ? "Checking price…" : "Reserve passes & view GCash QR"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </form>
            )}
            <BookingPolicy venue={venue} id="open-play-policy" />
          </>
        )}
      </div>
    </section>
  );
}
