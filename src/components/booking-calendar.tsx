"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Info, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { activeCourts, courtName, courtPhoto } from "@/lib/courts";
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
  openPlayCapacityLabel,
  equipmentPackageLabel,
  privateEquipmentLimit,
} from "@/lib/booking";
import type { Availability, PaymentOption, VenueSettings } from "@/lib/types";
import { reserveCourt } from "@/app/actions";
import { DateSlider } from "@/components/date-slider";
import { OpenPlayBooking } from "@/components/open-play-booking";
import { EquipmentRental } from "@/components/equipment-rental";
import { PaymentOptions } from "@/components/payment-options";
import { BookingPolicy, MobileBookingBar, MobileReviewHeading } from "./booking-checkout";
import {
  resolveSchedule,
  scheduleHours,
  type DaySchedule,
} from "@/lib/schedule";
import { TablePagination, useTablePage } from "./table-pagination";
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
  const selectedOpenSession =
    openSessions.find((b) => b.start === selectedSession) ?? openSessions[0];
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
  const summaryRef = useRef<HTMLElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const focusStep = useRef(initialReview);
  const modeButtonRef = useRef<HTMLButtonElement>(null);
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
  const preview = venue.opening_hour === null || venue.closing_hour === null;
  const hours = venue.schedule_config
    ? scheduleHours(daySchedule.blocks)
    : Array.from(
        { length: (venue.closing_hour ?? 22) - (venue.opening_hour ?? 6) },
        (_, i) => i + (venue.opening_hour ?? 6),
      );
  const courtHours = useTablePage(hours.length, date);
  const slots = availability?.date === date ? availability.slots : [];
  const loading = ready && (refreshing || (availability?.date !== date && !loadError));
  const reviewActive = reviewing && (mode === "open_play" || selection !== null);
  const bookingDateLabel = formatDate(date, { weekday: "long", month: "long", day: "numeric" });
  const hasFutureCourtHours = daySchedule.blocks.some((block) => block.kind === "court" && !isPastSlot(date, block.end - 1, now));
  const slotRows = hours.map((hour) => ({
    hour,
    session: openSessions.find((s) => hour >= s.start && hour < s.end),
    past: isPastSlot(date, hour, now),
    total: calculateCourtTotal(venue, hour, duration, date),
    scheduleLabel: courtScheduleLabel(venue, date, hour, duration),
  }));
  const privateStarts = slotRows.flatMap(({ hour, past, total, scheduleLabel }) =>
    !past && total !== null && !scheduleLabel ? [{ hour, total }] : [],
  );
  const mobileSlots = courts.map((court) => ({
    ...court,
    times: privateStarts.filter(({ hour }) => isSlotAvailable(slots, court.id, hour, duration)),
  })).filter(({ times }) => times.length > 0);
  const noPrivateTimes = !loading && !loadError && mobileSlots.length === 0;

  useEffect(() => {
    if (mode === "court" && reviewing && !selection) {
      focusStep.current = true;
      setReviewing(false);
    }
  }, [mode, reviewing, selection]);

  useEffect(() => {
    if (!focusStep.current) return;
    focusStep.current = false;
    if (!window.matchMedia("(max-width: 650px)").matches) return;
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
    setReviewing(false);
    setLoadError("");
    setError("");
  }
  function selectSlot(court: number, hour: number) {
    setSelection({ court, hour });
    setAccepted(false);
    setError("");
    if (window.innerWidth > 650 && window.innerWidth < 850)
      summaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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
    setAccepted(false);
    setError("");
  }
  function viewOpenPlay(start?: number) {
    if (start !== undefined) setSelectedSession(start);
    changeMode("open_play");
    modeButtonRef.current?.focus({ preventScroll: true });
  }
  function reserve(event: React.FormEvent) {
    event.preventDefault();
    if (!selection || !accepted || !open || loading || loadError || isPastSlot(date, selection.hour) ||
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
    <div className={`booking-layout ${styles.layout}`} ref={layoutRef}
      data-booking-review={reviewActive ? mode : undefined}>
      <div className={`booking-main ${styles.main}`}>
        <div className={styles.picker}>
        {!open && (
          <div className="notice">
            <Info size={17} />
            <span>
              <strong>Reservations opening soon.</strong>{" "}
              {preview
                ? "This is a preview of the calendar. Our hours and rates will be announced before booking opens."
                : "You can explore the schedule. Reservations will open when the venue is ready."}
            </span>
          </div>
        )}
        {(venue.schedule_config ||
          venue.open_play_enabled ||
          "schedule_config" in initialVenue) && (
          <div
            className="booking-mode-switch"
            role="group"
            aria-label="Reservation type"
          >
            <button
              type="button"
              className={mode === "court" ? "active" : ""}
              aria-pressed={mode === "court"}
              onClick={() => changeMode("court")}
            >
              Book a court
            </button>
            <button
              type="button"
              ref={modeButtonRef}
              className={mode === "open_play" ? "active" : ""}
              aria-pressed={mode === "open_play"}
              onClick={() => changeMode("open_play")}
            >
              Open play
            </button>
          </div>
        )}
        <div className={`calendar-toolbar ${styles.dateToolbar}`}>
          <div>
            <h2>{formatDate(date, { month: "long", year: "numeric" })}</h2>
            <p className={styles.desktopOnly}>
              {preview
                ? "Example hours · not the final schedule"
                : "Choose a date and an available time"}
            </p>
          </div>
          <label className={`field ${styles.calendarPicker}`}>
            <span><CalendarDays size={16} aria-hidden="true" /> Jump to date</span>
            <input
              aria-label="Booking date"
              type="date"
              value={date}
              min={today}
              max={addDays(today, 30)}
              onChange={(event) => changeDate(event.target.value)}
            />
          </label>
        </div>
        <DateSlider today={today} date={date} onChange={changeDate} />
        {daySchedule.override && (
          <div className={`notice schedule-period-notice ${styles.scheduleNotice}`}>
            <span>
              <strong>{daySchedule.override.name}</strong>
              <span className={styles.desktopOnly}> · Temporary schedule through {formatDate(daySchedule.override.end_date)}. Regular hours
                resume {formatDate(addDays(daySchedule.override.end_date, 1))}.</span>
              <span className={styles.mobileOnly}> · Regular hours resume {formatDate(addDays(daySchedule.override.end_date, 1), { month: "short", day: "numeric" })}.</span>
            </span>
          </div>
        )}
        </div>
        {mode === "open_play" ? (
          <OpenPlayBooking
            venue={venue}
            date={date}
            ready={ready && openPlayReady}
            signedIn={signedIn}
            userName={userName}
            selectedStart={selectedSession}
            onSessionChange={setSelectedSession}
            initialPlayers={initialPlayers}
            reviewing={reviewActive}
            onReviewChange={changeStep}
          />
        ) : (
          <>
            <div className={`notice booking-court-rules ${styles.desktopOnly}`}>
              <Info size={17} aria-hidden="true" />
              <span>
                Private bookings allow up to{" "}
                <strong>
                  {(selection
                    ? daySchedule.blocks.find(
                        (b) =>
                          b.kind === "court" &&
                          selection.hour >= b.start &&
                          selection.hour < b.end,
                      )?.capacity
                    : null) ?? venue.private_court_capacity}{" "}
                  players per court
                </strong>
                . Optional rental: {money(venue.equipment_rental_price)} per
                session per set:{" "}
                {equipmentPackageLabel(venue.equipment_ball_count)}.{" "}
                <Link
                  href="/court-rules"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="policy-link"
                >
                  Read court rules
                </Link>
                .
              </span>
            </div>
            {openSessions.length > 0 && (
              <div className={`notice weekend-schedule-note ${styles.desktopOnly}`}>
                <Info size={17} />
                <span>
                  {openSessions
                    .map(
                      (s) =>
                        `${formatHour(s.start)}–${formatHour(s.end)} · ${money(s.rate)}/person`,
                    )
                    .join("; ")}
                  .{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => viewOpenPlay()}
                  >
                    Get open-play passes <ArrowRight size={12} />
                  </button>
                </span>
              </div>
            )}
            <div className={`${styles.mobileOnly} ${styles.sectionHeading} ${styles.privateHeading}`}>
              <h2 id="mobile-court-availability" data-booking-availability-heading tabIndex={-1}>Availability</h2>
              <span>Philippine time</span>
            </div>
            <div className={`calendar-toolbar ${styles.durationToolbar}${!hasFutureCourtHours && !loadError ? ` ${styles.desktopOnly}` : ""}`}>
              <label className={`field${hasFutureCourtHours ? "" : ` ${styles.desktopOnly}`}`} style={{ width: 175 }}>
                <span className={styles.desktopOnly}>How long are we playing?</span>
                <span className={styles.mobileOnly}>Duration</span>
                <select
                  value={duration}
                  onChange={(e) => {
                    setDuration(Number(e.target.value));
                    setSelection(null);
                    setReviewing(false);
                    setAccepted(false);
                  }}
                >
                  {[1, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v} {v === 1 ? "hour" : "hours"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="icon-button"
                title="Refresh availability"
                aria-label="Refresh availability"
                disabled={loading || !ready}
                onClick={() => setRevision((v) => v + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {loadError && (
              <div className="error-message" role="alert">
                {loadError}
              </div>
            )}
            <section className={`${styles.mobileOnly} ${styles.availability}`} aria-labelledby="mobile-court-availability">
              {loading && <p className={styles.availabilityStatus} role="status">Checking availability…</p>}
              {!courts.length && <p className={styles.availabilityStatus}>No active courts are available. Please contact the venue.</p>}
              {courts.length > 0 && !loadError && (!loading || availability?.date === date) && (
                mobileSlots.length > 0 ? mobileSlots.map(({ id, name, times }) => (
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
                )) : openSessions.length === 0 && <div className={styles.sessionCard}>
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
                      {!ended && <button type="button" className="button button-dark"
                        onClick={() => viewOpenPlay(session.start)}>
                        View open play <ArrowRight size={15} aria-hidden="true" />
                      </button>}
                    </div>;
                  })}
                </div>
              )}
            </section>
            <div className={styles.desktopOnly}>
            <div className="calendar-legend">
              <span>
                <i className="legend-dot" />
                {open ? "Available" : "Preview slot"}
              </span>
              <span>
                <i className="legend-dot unavailable" />
                Unavailable
              </span>
              <span>
                <i className="legend-dot selected" />
                Your selection
              </span>
              {loading && <span>Updating…</span>}
            </div>
            {!courts.length && <div className="notice">No active courts are available. Please contact the venue.</div>}
            <div id="booking-court-slots" tabIndex={-1} role="region" aria-label="Court availability time slots"
              className="availability-grid dynamic-court-grid" aria-busy={loading} hidden={!courts.length}
              style={{ "--court-columns": courts.length } as CSSProperties}>
              <div className="availability-header booking-court-header">
                <div>PHT / UTC+8</div>
                {courts.map(({ id: court, name }) => (
                  <div className="court-column-heading" key={court}>
                    <div className="court-column-photo">
                      <Image
                        src={courtPhoto(court)}
                        alt=""
                        fill
                        sizes="(max-width: 650px) 35vw, (max-width: 850px) 40vw, 30vw"
                      />
                      <span className="court-column-label">{name}</span>
                    </div>
                  </div>
                ))}
              </div>
              {slotRows.slice(courtHours.start, courtHours.end).map(({ hour, session, past, total, scheduleLabel }) => (
                <div className="availability-row" key={hour}>
                  <div className="time-label">{formatHour(hour)}</div>
                  {session
                    ? (
                          <div className="slot-cell open-play-grid-cell">
                            <button
                              type="button"
                              className="open-play-grid-button"
                              disabled={
                                loading ||
                                Boolean(loadError) ||
                                isPastSlot(date, session.end, now)
                              }
                              aria-label={`Join open play, ${formatHour(session.start)} to ${formatHour(session.end)}`}
                              onClick={() => viewOpenPlay(session.start)}
                            >
                              Open play · Join session{" "}
                              {(hour === session.start || hour === hours[courtHours.start]) && (
                                <small>
                                  {formatHour(session.start)}–
                                  {formatHour(session.end)} ·{" "}
                                  {money(session.rate)}/person
                                </small>
                              )}
                            </button>
                          </div>
                      )
                    : courts.map(({ id: court, name }) => {
                        const fits = total !== null;
                        const available =
                          fits && isSlotAvailable(slots, court, hour, duration);
                        const selected =
                          selection?.court === court && selection.hour === hour;
                        const disabled =
                          !available ||
                          past ||
                          loading ||
                          Boolean(loadError) ||
                          Boolean(scheduleLabel);
                        return (
                          <div className="slot-cell" key={court}>
                            <button
                              type="button"
                              className={`slot-button ${selected ? "active" : ""}`}
                              disabled={disabled}
                              aria-label={`${name}, ${formatHour(hour)}, ${scheduleLabel || (past ? "past" : !fits ? "outside hours" : !available ? "unavailable" : "available")}`}
                              aria-pressed={selected}
                              onClick={() => selectSlot(court, hour)}
                            >
                              {scheduleLabel ? (
                                scheduleLabel
                              ) : selected ? (
                                <>
                                  <Check size={12} />
                                  Selected
                                </>
                              ) : past ? (
                                "Past"
                              ) : !fits ? (
                                "Outside hours"
                              ) : !available ? (
                                "Reserved"
                              ) : open ? (
                                "Available"
                              ) : (
                                "Preview"
                              )}
                            </button>
                          </div>
                        );
                      })}
                </div>
              ))}
              {!hours.length && (
                <div className="empty-state">
                  <h3>No sessions scheduled</h3>
                  <p>The venue is closed on this date. Choose another date.</p>
                </div>
              )}
            </div>
            {courts.length > 0 && (
              <TablePagination {...courtHours} label="Court availability time slot pages" anchorId="booking-court-slots" />
            )}
            </div>
            {selection && !reviewActive && (
              <MobileBookingBar
                total={quoteLoading ? "Checking price…" : quote?.failed ? "Price unavailable" : bookingTotal === null ? "Price pending" : money(bookingTotal)}
                selection={`${courtName(venue.courts, selection.court)} · ${formatHour(selection.hour)}–${formatHour(selection.hour + duration)}`}
                disabled={loading || Boolean(loadError) || isPastSlot(date, selection.hour, now)}
                onContinue={() => changeStep(true)}
              />
            )}
          </>
        )}
      </div>
      <aside
        className={`panel booking-sidebar ${styles.summary}`}
        ref={summaryRef}
        style={{ scrollMarginTop: 110 }}
      >
        {mode === "court" && <MobileReviewHeading onBack={() => changeStep(false)} disabled={pending} />}
        <span className={`eyebrow ${styles.desktopOnly}`}>YOUR NEXT GAME</span>
        <h3 className={styles.desktopOnly} style={{ marginTop: 12 }}>Booking summary</h3>
        <p className={styles.desktopOnly}>Good times start with a plan.</p>
        {mode === "open_play" ? (
          <div className="open-play-sidebar">
            <CalendarDays size={38} />
            <h3>
              {selectedOpenSession
                ? `${formatHour(selectedOpenSession.start)}–${formatHour(selectedOpenSession.end)}`
                : "No session scheduled"}
            </h3>
            <p>
              {formatDate(date, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
            {selectedOpenSession && (
              <strong>
                {money(selectedOpenSession.rate)} / person / session
              </strong>
            )}
            {selectedOpenSession && (
              <p>
                One pass covers the session. Share the active courts and rotate
                between games.
              </p>
            )}
            {selectedOpenSession && (
              <p>{openPlayCapacityLabel(selectedOpenSession.capacity, courts.length)}.</p>
            )}
          </div>
        ) : !selection ? (
          <div className="summary-placeholder">
            <CalendarDays size={38} />
            <p>
              Choose a court and time
              <br />
              to see your booking here.
            </p>
          </div>
        ) : (
          <>
            <dl className="summary-rows">
              <div>
                <dt>Court</dt>
                <dd>{courtName(venue.courts, selection.court)}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(date, { month: "short", day: "numeric" })}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {formatHour(selection.hour)} –{" "}
                  {formatHour(selection.hour + duration)}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>
                  {duration} {duration === 1 ? "hour" : "hours"}
                </dd>
              </div>
              {getPriceBreakdown(venue, selection.hour, duration, date).map(
                (part) => (
                  <div key={part.start}>
                    <dt>
                      {formatHour(part.start)} – {formatHour(part.end)}
                    </dt>
                    <dd>
                      {part.hours} {part.hours === 1 ? "hr" : "hrs"} ×{" "}
                      {money(part.rate)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
            <p className={`small-print ${styles.mobileOnly}`}>
              Up to {equipmentLimit} players per court.
            </p>
            <EquipmentRental
              price={venue.equipment_rental_price}
              ballCount={venue.equipment_ball_count}
              quantity={equipmentQuantity}
              maxQuantity={equipmentLimit}
              onChange={setEquipmentQuantity}
              disabled={pending}
            />
            <dl className="summary-rows equipment-cost-rows">
              <div>
                <dt>Court subtotal</dt>
                <dd>{courtSubtotal === null ? "To be announced" : money(courtSubtotal)}</dd>
              </div>
              {memberDiscount > 0 && <div>
                <dt>Membership discount</dt><dd>−{money(memberDiscount)}</dd>
              </div>}
              <div>
                <dt>Equipment rental</dt>
                <dd>
                  {money(equipmentQuantity * venue.equipment_rental_price)}
                </dd>
              </div>
            </dl>
            <div className="summary-total">
              <span>Booking total</span>
              <strong>{quoteLoading ? "Checking price…" : quote?.failed ? "Unavailable" : bookingTotal === null ? "To be announced" : money(bookingTotal)}</strong>
            </div>
            {quote?.failed && <div className="error-message" role="alert">
              Couldn’t check your member price. <button className="button button-small button-outline" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button>
            </div>}
            {!quoteLoading && !quote?.failed && bookingTotal !== null && <PaymentOptions
              total={bookingTotal}
              value={paymentOption}
              onChange={setPaymentOption}
              disabled={pending}
            />}
            {!open ? (
              <div className="notice">
                <Info size={16} />
                <span>
                  Booking will open once our rates, hours, and GCash details are
                  ready.
                </span>
              </div>
            ) : !signedIn ? (
              <>
                <Link
                  className="button button-dark"
                  href={`/login?next=${encodeURIComponent(`/book?court=${selection.court}&date=${date}&start=${selection.hour}&duration=${duration}&review=1`)}`}
                >
                  Sign in to reserve <ArrowRight size={16} />
                </Link>
                <p className="small-print">
                  Availability is rechecked when you reserve.
                </p>
              </>
            ) : (
              <form onSubmit={reserve} className="form-stack">
                <label className="field">
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>Mobile number</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="09171234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    gap: 9,
                    fontSize: 14,
                    lineHeight: 1.8,
                  }}
                >
                  <input
                    type="checkbox"
                    required
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="#booking-policy"
                      style={{ textDecoration: "underline" }}
                    >
                      booking and cancellation policy
                    </a>{" "}
                    and the{" "}
                    <Link
                      href="/court-rules"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="policy-link"
                    >
                      court rules
                    </Link>
                    .
                  </span>
                </label>
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}
                <button
                  className="button button-dark"
                  disabled={
                    pending || loading || Boolean(loadError) || !accepted || isPastSlot(date, selection.hour, now) ||
                    quoteLoading || Boolean(quote?.failed) || bookingTotal === null
                  }
                >
                  {pending ? "Reserving…" : "Reserve & view GCash QR"}
                  <ArrowRight size={16} />
                </button>
                <p className="small-print">
                  Your slot is held for {venue.hold_minutes} minutes. Submit
                  your GCash reference before the deadline. Staff confirms after
                  checking payment.
                </p>
              </form>
            )}
          </>
        )}
        <BookingPolicy venue={venue} id="booking-policy" />
      </aside>
    </div>
  );
}
