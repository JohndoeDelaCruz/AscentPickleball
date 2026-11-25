"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Info, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { activeCourts, courtName } from "@/lib/courts";
import {
  addDays,
  canBook,
  calculateCourtTotal,
  calculateReservationTotal,
  formatDate,
  formatHour,
  getPriceBreakdown,
  isPastSlot,
  isSlotAvailable,
  isValidDate,
  localDate,
  money,
  courtScheduleLabel,
  privateEquipmentLimit,
} from "@/lib/booking";
import type { Availability, PaymentOption, VenueSettings } from "@/lib/types";
import { reserveCourt } from "@/app/actions";
import { DateSlider } from "@/components/date-slider";
import { OpenPlayBooking } from "@/components/open-play-booking";
import { EquipmentRental } from "@/components/equipment-rental";
import { PaymentOptions } from "@/components/payment-options";
import { BookingBar, BookingPolicy, BookingReviewHeading, type BookingBarDetails } from "./booking-checkout";
import {
  resolveSchedule,
  scheduleHours,
  type DaySchedule,
} from "@/lib/schedule";
import styles from "./booking-calendar.module.css";

export function BookingCalendar({
  venue: initialVenue,
  ready,
  signedIn,
  userName,
  initialDate,
  openPlayReady,
  initialOpenPlay = false,
  initialSession,
  initialCourt,
  initialHour,
  initialDuration,
  initialPlayers,
  initialReview = false,
}: {
  venue: VenueSettings;
  ready: boolean;
  signedIn: boolean;
  userName: string;
  initialDate?: string;
  openPlayReady: boolean;
  initialOpenPlay?: boolean;
  initialSession?: number;
  initialCourt?: number;
  initialHour?: number;
  initialDuration?: number;
  initialPlayers?: number;
  initialReview?: boolean;
}) {
  const courts = activeCourts(initialVenue.courts);
  const [mode, setMode] = useState<"court" | "open_play">(
    initialOpenPlay ? "open_play" : "court",
  );
  const [today] = useState(localDate);
  const validInitial =
    isValidDate(initialDate) &&
    initialDate >= today &&
    initialDate <= addDays(today, 30)
      ? initialDate
      : today;
  const [date, setDate] = useState(validInitial);
  const [liveSchedule, setLiveSchedule] = useState<{
    date: string;
    schedule: DaySchedule;
  } | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(
    initialSession ?? null,
  );
  const daySchedule =
    liveSchedule?.date === date
      ? liveSchedule.schedule
      : resolveSchedule(initialVenue, date);
  const venue =
    liveSchedule?.date === date
      ? {
          ...initialVenue,
          schedule_config: { weekly: daySchedule.blocks, overrides: [] },
        }
      : initialVenue;
  const openSessions = daySchedule.blocks.filter((b) => b.kind === "open_play");
  const [duration, setDuration] = useState(initialDuration && [1, 2, 3, 4].includes(initialDuration) ? initialDuration : 1);
  const [selection, setSelection] = useState<{
    court: number;
    hour: number;
  } | null>(() =>
    !initialOpenPlay && initialDate === validInitial && initialCourt !== undefined && courts.some(({ id }) => id === initialCourt) &&
    initialHour !== undefined && initialHour >= 0 && initialHour < 24 &&
    calculateCourtTotal(initialVenue, initialHour, duration, validInitial) !== null &&
    !courtScheduleLabel(initialVenue, validInitial, initialHour, duration) && !isPastSlot(validInitial, initialHour)
      ? { court: initialCourt, hour: initialHour }
      : null,
  );
  const [reviewing, setReviewing] = useState(initialReview);
  const [openBookingBar, setOpenBookingBar] = useState<BookingBarDetails | null>(null);
  const [availability, setAvailability] = useState<{ date: string; slots: Availability[] } | null>(null);
  const [refreshing, setRefreshing] = useState(ready);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState("");
  const [requestedEquipmentQuantity, setEquipmentQuantity] = useState(0);
  const equipmentLimit = privateEquipmentLimit(
    venue,
    date,
    selection?.hour,
    duration,
  );
  const equipmentQuantity = Math.min(
    requestedEquipmentQuantity,
    equipmentLimit,
  );
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");
  const [accepted, setAccepted] = useState(false);
  const [revision, setRevision] = useState(0);
  const [memberQuote, setMemberQuote] = useState<{ key: string; discount: number; failed?: true } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const layoutRef = useRef<HTMLDivElement>(null);
  const focusStep = useRef(initialReview);
  const router = useRouter();
  const open = ready && openPlayReady && canBook(venue);
  const selectedHour = selection?.hour;
  const quoteKey = open && signedIn && mode === "court" && selectedHour !== undefined
    ? `${date}:${selectedHour}:${duration}:${revision}` : null;
  const quote = memberQuote?.key === quoteKey ? memberQuote : null;
  const quoteLoading = quoteKey !== null && !quote;
  const memberDiscount = quote?.discount ?? 0;
  const courtSubtotal = selectedHour === undefined ? null : calculateCourtTotal(venue, selectedHour, duration, date);
  const bookingTotal = courtSubtotal === null ? null : calculateReservationTotal(
    courtSubtotal - memberDiscount, venue.equipment_rental_price, equipmentQuantity,
  );
  const slots = availability?.date === date ? availability.slots : [];
  const loading = ready && (refreshing || (availability?.date !== date && !loadError));
  const reviewActive = reviewing && (mode === "open_play" || selection !== null);
  const bookingDateLabel = formatDate(date, { weekday: "long", month: "long", day: "numeric" });
  const hasFutureCourtHours = daySchedule.blocks.some((block) => block.kind === "court" && !isPastSlot(date, block.end - 1, now));
  const privateStarts = scheduleHours(daySchedule.blocks).flatMap((hour) => {
    if (isPastSlot(date, hour, now) || courtScheduleLabel(venue, date, hour, duration)) return [];
    const total = calculateCourtTotal(venue, hour, duration, date);
    return total === null ? [] : [{ hour, total }];
  });
  const availableCourts = courts.map((court) => ({
    ...court,
    times: privateStarts.filter(({ hour }) => isSlotAvailable(slots, court.id, hour, duration)),
  })).filter(({ times }) => times.length > 0);
  const noPrivateTimes = !loading && !loadError && availableCourts.length === 0;
  const courtBookingBar = selection ? {
    total: quoteLoading ? "Checking price…" : quote?.failed ? "Price unavailable" : bookingTotal === null ? "Price pending" : money(bookingTotal),
    selection: `${courtName(venue.courts, selection.court)} · ${formatHour(selection.hour)}–${formatHour(selection.hour + duration)}`,
    disabled: loading || Boolean(loadError) || isPastSlot(date, selection.hour, now),
  } : null;
  const bookingBar = reviewActive ? null : mode === "open_play" ? openBookingBar : courtBookingBar;

  useEffect(() => {
    if (mode === "court" && reviewing && !selection) {
      focusStep.current = true;
      setReviewing(false);
    }
  }, [mode, reviewing, selection]);

  useEffect(() => {
    if (!focusStep.current) return;
    focusStep.current = false;
    const marker = reviewActive ? "[data-booking-review-heading]" : "[data-booking-availability-heading]";
    const target = layoutRef.current?.querySelector<HTMLElement>(marker);
    target?.focus({ preventScroll: true });
    (reviewActive ? target?.parentElement : layoutRef.current)?.scrollIntoView({ block: "start" });
  }, [reviewActive, mode]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const key = quoteKey;
    if (!key || selectedHour === undefined) return;
    let active = true;
    const client = createClient();
    async function loadQuote(key: string, hour: number) {
      try {
        const { data, error } = await client.rpc("get_private_booking_member_discount", {
          p_date: date, p_start: hour, p_duration: duration,
        });
        if (!active) return;
        if (error?.code === "PGRST202") {
          setMemberQuote({ key, discount: 0 });
        } else if (error || typeof data !== "number" || !Number.isFinite(data) || data < 0) {
          setMemberQuote({ key, discount: 0, failed: true });
        } else {
          setMemberQuote({ key, discount: data });
        }
      } catch {
        if (active) setMemberQuote({ key, discount: 0, failed: true });
      }
    }
    void loadQuote(key, selectedHour);
    return () => { active = false; };
  }, [quoteKey, date, selectedHour, duration]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const client = createClient();
    async function refresh() {
      setRefreshing(true);
      const [{ data, error: requestError }, scheduleResult] = await Promise.all(
        [
          client.rpc("get_availability", { p_date: date }),
          "schedule_config" in initialVenue
            ? client.rpc("get_booking_schedule", { p_date: date })
            : Promise.resolve({ data: null, error: null }),
        ],
      );
      if (!active) return;
      setRefreshing(false);
      if (requestError || scheduleResult.error) {
        setLoadError(
          "We couldn’t load live availability. Please try again before reserving.",
        );
        return;
      }
      setLoadError("");
      setAvailability({ date, slots: data || [] });
      if (scheduleResult.data)
        setLiveSchedule({ date, schedule: scheduleResult.data as DaySchedule });
      const checkedVenue = scheduleResult.data
        ? {
            ...initialVenue,
            schedule_config: {
              weekly: (scheduleResult.data as DaySchedule).blocks,
              overrides: [],
            },
          }
        : initialVenue;
      setSelection((selected) =>
        selected &&
        !isPastSlot(date, selected.hour) &&
        isSlotAvailable(data || [], selected.court, selected.hour, duration) &&
        !courtScheduleLabel(checkedVenue, date, selected.hour, duration) &&
        calculateCourtTotal(checkedVenue, selected.hour, duration, date) !==
          null
          ? selected
          : null,
      );
    }
    refresh();
    const interval = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [date, ready, revision, duration, initialVenue]);

  function changeDate(value: string) {
    if (
      !isValidDate(value) ||
      value < today ||
      value > addDays(today, 30) ||
      value === date
    )
      return;
    setDate(value);
    setSelection(null);
    setSelectedSession(null);
    setOpenBookingBar(null);
    setReviewing(false);
    setAccepted(false);
    setLoadError("");
    setError("");
  }
  function selectSlot(court: number, hour: number) {
    setSelection({ court, hour });
    setAccepted(false);
    setError("");
  }
  function changeStep(review: boolean) {
    focusStep.current = true;
    setReviewing(review);
  }
  function changeMode(next: typeof mode) {
    if (mode === next) return;
    setMode(next);
    setReviewing(false);
    setSelection(null);
    setOpenBookingBar(null);
    setAccepted(false);
    setError("");
  }
  function viewOpenPlay(start: number) {
    focusStep.current = true;
    setSelectedSession(start);
    changeMode("open_play");
  }
  function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewActive || !selection || !accepted || !open || loading || loadError || isPastSlot(date, selection.hour) ||
      quoteLoading || quote?.failed || bookingTotal === null) return;
    setError("");
    startTransition(async () => {
      const result = await reserveCourt({
        court_id: selection.court,
        booking_date: date,
        start_hour: selection.hour,
        duration,
        customer_name: name,
        customer_phone: phone,
        equipment_rental: equipmentQuantity > 0,
        equipment_quantity: equipmentQuantity,
        payment_option: paymentOption,
        expected_total_cents: Math.round(bookingTotal * 100),
      });
      if (result.error) {
        setError(result.error);
        setRevision((v) => v + 1);
      } else if (result.id) router.push(`/booking/${result.id}`);
    });
  }

  return (
    <div className={styles.layout} ref={layoutRef}>
      {!reviewActive && (
        <>
          <h1 className={styles.pageTitle}>Find your court.</h1>
          <div className={styles.picker}>
            {(venue.schedule_config || venue.open_play_enabled || "schedule_config" in initialVenue) && (
              <div className="booking-mode-switch" role="group" aria-label="Reservation type">
                <button type="button" className={mode === "court" ? "active" : ""}
                  aria-pressed={mode === "court"} onClick={() => changeMode("court")}>
                  Book a court
                </button>
                <button type="button" className={mode === "open_play" ? "active" : ""}
                  aria-pressed={mode === "open_play"} onClick={() => changeMode("open_play")}>
                  Open play
                </button>
              </div>
            )}
            <div className={styles.dateToolbar}>
              <h2>{formatDate(date, { month: "long", year: "numeric" })}</h2>
              <label className={styles.calendarPicker}>
                <span><CalendarDays size={16} aria-hidden="true" /> Jump to date</span>
                <input aria-label="Booking date" type="date" value={date}
                  min={today} max={addDays(today, 30)} onChange={(event) => changeDate(event.target.value)} />
              </label>
            </div>
            <DateSlider today={today} date={date} onChange={changeDate} />
            {daySchedule.override && (
              <p className={styles.scheduleNotice}>
                <strong>{daySchedule.override.name}</strong> · Regular hours resume{" "}
                {formatDate(addDays(daySchedule.override.end_date, 1), { month: "short", day: "numeric" })}.
              </p>
            )}
            {!open && (
              <p className={styles.scheduleNotice}><Info size={15} aria-hidden="true" /> Reservations opening soon. You can preview the schedule.</p>
            )}
          </div>
        </>
      )}
      {mode === "open_play" ? (
        <OpenPlayBooking venue={venue} date={date} ready={ready && openPlayReady}
          signedIn={signedIn} userName={userName} selectedStart={selectedSession}
          onSessionChange={setSelectedSession} initialPlayers={initialPlayers}
          reviewing={reviewActive} onReviewChange={changeStep} onBookingBarChange={setOpenBookingBar} />
      ) : reviewActive && selection ? (
        <section className={styles.review} aria-label="Private court booking review">
          <BookingReviewHeading onBack={() => changeStep(false)} disabled={pending} />
          <div className={`panel ${styles.reviewPanel}`}>
            <dl className="summary-rows">
              <div><dt>Court</dt><dd>{courtName(venue.courts, selection.court)}</dd></div>
              <div><dt>Date</dt><dd>{bookingDateLabel}</dd></div>
              <div><dt>Time</dt><dd>{formatHour(selection.hour)}–{formatHour(selection.hour + duration)}</dd></div>
              <div><dt>Duration</dt><dd>{duration} {duration === 1 ? "hour" : "hours"}</dd></div>
              {getPriceBreakdown(venue, selection.hour, duration, date).map((part) => (
                <div key={part.start}>
                  <dt>{formatHour(part.start)}–{formatHour(part.end)}</dt>
                  <dd>{part.hours} {part.hours === 1 ? "hr" : "hrs"} × {money(part.rate)}</dd>
                </div>
              ))}
            </dl>
            <p className="small-print">Up to {equipmentLimit} players per court.</p>
            <EquipmentRental price={venue.equipment_rental_price} ballCount={venue.equipment_ball_count}
              quantity={equipmentQuantity} maxQuantity={equipmentLimit} onChange={setEquipmentQuantity} disabled={pending} />
            <dl className="summary-rows equipment-cost-rows">
              <div><dt>Court subtotal</dt><dd>{courtSubtotal === null ? "To be announced" : money(courtSubtotal)}</dd></div>
              {memberDiscount > 0 && (
                <div><dt>Membership discount</dt><dd>−{money(memberDiscount)}</dd></div>
              )}
              <div><dt>Equipment rental</dt><dd>{money(equipmentQuantity * venue.equipment_rental_price)}</dd></div>
            </dl>
            <div className="summary-total">
              <span>Booking total</span>
              <strong>{quoteLoading ? "Checking price…" : quote?.failed ? "Unavailable" : bookingTotal === null ? "To be announced" : money(bookingTotal)}</strong>
            </div>
            {(quote?.failed || loadError) && (
              <div className="error-message" role="alert">
                {loadError || "Couldn’t check your member price."}{" "}
                <button className="button button-small button-outline" type="button" onClick={() => setRevision((value) => value + 1)}>
                  Retry
                </button>
              </div>
            )}
            {!quoteLoading && !quote?.failed && bookingTotal !== null && (
              <PaymentOptions total={bookingTotal} value={paymentOption} onChange={setPaymentOption} disabled={pending} />
            )}
            {!open ? (
              <div className="notice"><Info size={16} aria-hidden="true" /> Booking will open once our rates, hours, and GCash details are ready.</div>
            ) : !signedIn ? (
              <Link className="button button-dark" href={`/login?next=${encodeURIComponent(
                `/book?court=${selection.court}&date=${date}&start=${selection.hour}&duration=${duration}&review=1`,
              )}`}>
                Sign in to reserve <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <form onSubmit={reserve} className="form-stack">
                <div className="field-grid">
                  <label className="field">
                    <span>Full name</span>
                    <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)}
                      required minLength={2} maxLength={100} />
                  </label>
                  <label className="field">
                    <span>Mobile number</span>
                    <input type="tel" autoComplete="tel" placeholder="09171234567" value={phone}
                      onChange={(event) => setPhone(event.target.value)} required />
                  </label>
                </div>
                <label className="open-play-agreement">
                  <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>
                    I agree to the <a href="#booking-policy" className="policy-link">booking and cancellation policy</a> and the{" "}
                    <Link href="/court-rules" target="_blank" rel="noopener noreferrer" className="policy-link">court rules</Link>.
                  </span>
                </label>
                {error && <div className="error-message" role="alert">{error}</div>}
                <button className="button button-dark" disabled={
                  pending || loading || Boolean(loadError) || !accepted || isPastSlot(date, selection.hour, now) ||
                  quoteLoading || Boolean(quote?.failed) || bookingTotal === null
                }>
                  {pending ? "Reserving…" : "Reserve & view GCash QR"} <ArrowRight size={16} aria-hidden="true" />
                </button>
                <p className="small-print">
                  Your slot is held for {venue.hold_minutes} minutes. Submit your GCash reference before the deadline.
                  Staff confirms after checking payment.
                </p>
              </form>
            )}
            <BookingPolicy venue={venue} id="booking-policy" />
          </div>
        </section>
      ) : (
        <section className={styles.availability} aria-labelledby="court-availability">
          <div className={styles.availabilityToolbar}>
            <div className={styles.sectionHeading}>
              <h2 id="court-availability" data-booking-availability-heading tabIndex={-1}>Availability</h2>
              <span>Philippine time</span>
            </div>
            {(hasFutureCourtHours || loadError) && (
              <div className={styles.durationToolbar}>
                {hasFutureCourtHours && (
                  <label className="field">
                    <span>Duration</span>
                    <select value={duration} onChange={(event) => {
                      setDuration(Number(event.target.value));
                      setSelection(null);
                      setAccepted(false);
                    }}>
                      {[1, 2, 3, 4].map((hours) => (
                        <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="button" className="icon-button" title="Refresh availability" aria-label="Refresh availability"
                  disabled={loading || !ready} onClick={() => setRevision((value) => value + 1)}>
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {loadError && <div className="error-message" role="alert">{loadError}</div>}
          {loading && <p className={styles.availabilityStatus} role="status">Checking availability…</p>}
          {!courts.length && <p className={styles.availabilityStatus}>No active courts are available. Please contact the venue.</p>}
          {!loadError && availableCourts.length > 0 && (!loading || availability?.date === date) && (
            <div className={styles.courtCards} aria-busy={loading}>
              {availableCourts.map(({ id, name, times }) => (
                <div className={styles.sessionCard} key={id} role="group" aria-label={`${name} available times for ${bookingDateLabel}`}>
                  <h3>{name}</h3>
                  <div className={styles.timeChoices}>
                    {times.map(({ hour, total }) => (
                      <button key={hour} type="button" className="slot-button" disabled={loading}
                        aria-pressed={selection?.court === id && selection.hour === hour}
                        onClick={() => selectSlot(id, hour)}>
                        <strong>{formatHour(hour)}</strong>
                        <small>{money(total)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {courts.length > 0 && noPrivateTimes && openSessions.length === 0 && (
            <div className={styles.sessionCard}>
              <h3>No private court times</h3>
              <p>Choose another date{hasFutureCourtHours ? " or try a shorter duration" : ""}.</p>
            </div>
          )}
          {openSessions.length > 0 && (
            <div className={`${styles.sessionCard} ${styles.openAlternative}`}>
              <h3>{noPrivateTimes ? "No private court times" : "Open play"}</h3>
              {openSessions.map((session) => {
                const ended = isPastSlot(date, session.end, now);
                return <div key={session.id} className={styles.sessionAlternativeRow}>
                  <div>
                    {noPrivateTimes && <p>Open play</p>}
                    <strong>{formatHour(session.start)}–{formatHour(session.end)}</strong>
                    <p>{money(session.rate)} / person{ended ? " · Ended" : ""}</p>
                  </div>
                  {!ended && (
                    <button type="button" className="button button-dark" onClick={() => viewOpenPlay(session.start)}>
                      View open play <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>;
              })}
            </div>
          )}
        </section>
      )}
      <BookingBar details={bookingBar} onContinue={() => changeStep(true)} />
    </div>
  );
}
