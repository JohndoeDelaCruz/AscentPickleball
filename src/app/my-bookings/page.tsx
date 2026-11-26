import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, ChevronRight, Clock3, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { CurrentMatches } from "@/components/current-matches";
import { OffDutyCloseout } from "@/components/off-duty-closeout";
import { addDays, formatDate, formatHour, localDate, money, TIME_ZONE } from "@/lib/booking";
import { pickupDeadline, pickupOrderPath, pickupOrderSchema } from "@/lib/counter-orders";
import { courtName } from "@/lib/courts";
import { getCurrentMembership, getSession, getVenue } from "@/lib/data";
import { membershipApplyPath, membershipStatus } from "@/lib/membership-applications";
import { bookingPayments } from "@/lib/payment";
import type { Shift } from "@/lib/pos";
import { createClient } from "@/lib/supabase/server";
import { bookingStatusLabel, type Booking } from "@/lib/types";
import styles from "./my-bookings.module.css";

export const metadata: Metadata = { title: "My bookings" };

const bookingColumns = "id,court_id,booking_type,participant_count,booking_date,start_hour,duration,total_amount,payment_option,initial_payment_amount,paid_amount,status,hold_expires_at";
type BookingSummary = Pick<Booking,
  "id" | "court_id" | "booking_type" | "participant_count" | "booking_date" | "start_hour" | "duration" |
  "total_amount" | "payment_option" | "initial_payment_amount" | "paid_amount" | "status" | "hold_expires_at"
>;

const localHour = new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });
const deadlineClock = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit",
});

export default async function MyBookings() {
  const { user, offDuty } = await getSession();
  if (!user) redirect("/login?next=/my-bookings");

  const db = await createClient();
  const now = new Date();
  const today = localDate(now);
  const hour = Number(localHour.format(now));
  const nowIso = now.toISOString();
  // PostgREST compares individual columns. For earlier starts, require enough whole hours to end after the current hour.
  const remainingToday = Array.from({ length: hour }, (_, start) =>
    `and(start_hour.eq.${start},duration.gt.${hour - start})`);
  remainingToday.push(`start_hour.gte.${hour}`);
  const upcoming = () => db.from("bookings").select(bookingColumns).eq("user_id", user.id)
    .or(`booking_date.gt.${today},and(booking_date.eq.${today},or(${remainingToday.join(",")}))`);

  const [
    { venue },
    { data: upcomingRows, error: bookingsError },
    { data: hold },
    membership,
    { data: pickupRows },
    openShiftResult,
  ] = await Promise.all([
    getVenue(),
    upcoming()
      .or(`status.in.(confirmed,awaiting_verification),and(status.eq.awaiting_payment,hold_expires_at.gt.${nowIso})`)
      .order("booking_date").order("start_hour").order("id").limit(3),
    upcoming()
      .eq("status", "awaiting_payment").gt("hold_expires_at", nowIso)
      .order("hold_expires_at").order("id").limit(1).maybeSingle(),
    getCurrentMembership(user.id),
    db.rpc("list_my_counter_orders"),
    offDuty ? db.rpc("pos_own_open_shift").maybeSingle() : null,
  ]);

  const bookings: BookingSummary[] = upcomingRows ?? [];
  const hasToday = bookings.some((booking) => booking.booking_date === today);
  const openShift = openShiftResult?.data as Shift | null | undefined;
  const paymentExpiry = hold?.hold_expires_at ? new Date(hold.hold_expires_at) : null;
  const paymentDay = paymentExpiry && localDate(paymentExpiry);
  const paymentDue = paymentDay === today ? "today"
    : paymentDay === addDays(today, 1) ? "tomorrow"
      : paymentDay ? formatDate(paymentDay, { month: "short", day: "numeric" }) : "";
  const currentMembershipStatus = membership ? membershipStatus(membership, today) : null;
  const pickup = z.array(pickupOrderSchema).safeParse(pickupRows).data
    ?.filter((order) => order.status === "pending" && Date.parse(order.expires_at) > now.getTime())
    .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at))[0];
  const showOpenPlay = venue.schedule_config
    ? venue.schedule_config.weekly.some((block) => block.kind === "open_play") ||
      venue.schedule_config.overrides.some((period) =>
        period.end_date >= today && period.blocks.some((block) => block.kind === "open_play"))
    : venue.open_play_enabled;
  const titleForBooking = (booking: Pick<Booking, "booking_type" | "court_id">) =>
    booking.booking_type === "open_play" ? "Open play"
      : booking.court_id === null ? "Private court" : courtName(venue.courts, booking.court_id);

  return (
    <main id="main" className={`container content-page ${styles.page}`}>
      <header className={styles.heading}>
        <h1>My bookings</h1>
        {(bookings.length > 0 || bookingsError) && (
          <Link href="/book" className="button button-dark button-small">
            Book a court <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>
      {offDuty && (
        <div className="notice" role="status">
          <span>Another front desk staff member is on duty today. If you’re covering the shift, ask a manager to update today’s assignment.</span>
        </div>
      )}
      {openShift && <OffDutyCloseout shift={openShift} operator={user.email ?? "Signed-in staff"} />}
      {hold && paymentExpiry && (
        <section className={styles.paymentNotice} aria-labelledby="customer-payment-due">
          <span className={styles.iconTile}><Clock3 size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="customer-payment-due">
              <time dateTime={paymentExpiry.toISOString()}>
                {money(bookingPayments(hold).initial)} due {paymentDue} at{" "}
                <span className={styles.deadlineClock}>{deadlineClock.format(paymentExpiry)}</span>
              </time>
            </h2>
            <p>{titleForBooking(hold)} · GCash payment</p>
          </div>
          <Link href={`/booking/${hold.id}#gcash-payment`} className="button button-dark button-small">
            Continue payment <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}

      <div className={styles.columns}>
        <section aria-labelledby="customer-upcoming">
          <header className={styles.sectionHeader}>
            <h2 id="customer-upcoming">{hasToday ? "Today and upcoming" : "Upcoming bookings"}</h2>
            <Link href="/my-bookings/all" prefetch={false} className={styles.textLink}>
              See all bookings <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </header>
          {bookingsError ? (
            <div className="error-message" role="alert">Upcoming bookings couldn’t be loaded. Please refresh and try again.</div>
          ) : bookings.length ? (
            <ul className={`panel ${styles.bookings}`} role="list">
              {bookings.map((booking) => {
                const title = titleForBooking(booking);
                const bookingTime = `${formatHour(booking.start_hour)}–${formatHour(booking.start_hour + booking.duration)}`;
                const date = formatDate(booking.booking_date, { weekday: "short", month: "short", day: "numeric" });
                const { balance } = bookingPayments(booking);
                const inProgress = booking.booking_date === today && booking.start_hour <= hour && booking.status === "confirmed";
                const statusId = `booking-status-${booking.id}`;
                return (
                  <li key={booking.id}>
                    <Link href={`/booking/${booking.id}`} prefetch={false} className={styles.booking}
                      aria-label={`View booking for ${title}, ${date}, ${bookingTime}`} aria-describedby={statusId}>
                      <div className={styles.dateTile} aria-hidden="true">
                        <span>{formatDate(booking.booking_date, { month: "short" })}</span>
                        <strong>{formatDate(booking.booking_date, { day: "numeric" })}</strong>
                      </div>
                      <div className={styles.bookingInfo}>
                        <h3>
                          {title}
                          {booking.booking_type === "open_play" && (
                            <span> · {booking.participant_count} {booking.participant_count === 1 ? "pass" : "passes"}</span>
                          )}
                        </h3>
                        <p>{date} · {bookingTime}</p>
                        <div id={statusId}>
                          <div className={styles.bookingStatuses}>
                            <span className={styles.status} data-tone={booking.status === "confirmed" ? "green" : "amber"}>
                              {bookingStatusLabel(booking)}
                            </span>
                            {inProgress && <span className={styles.status}>In progress</span>}
                          </div>
                          {booking.status === "confirmed" && (
                            <p>{balance > 0 ? `${money(balance)} balance at the venue` : "Fully paid"}</p>
                          )}
                        </div>
                      </div>
                      <span className={styles.bookingAction} aria-hidden="true">
                        <span>View booking</span><ChevronRight size={18} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={`panel ${styles.empty}`}>
              <span className={styles.iconTile}><CalendarDays size={20} aria-hidden="true" /></span>
              <h3>No upcoming bookings</h3>
              <p>Find a court time{showOpenPlay && " or join a shared open-play session"}.</p>
              <div className={styles.emptyActions}>
                <Link href="/book" className="button button-dark button-small">
                  Book a court <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                {showOpenPlay && <Link href="/book?play=open" className="button button-outline button-small">Join open play</Link>}
              </div>
            </div>
          )}
        </section>

        <aside className={styles.sidebar} aria-label="Membership and pickup orders">
          <section className={`panel ${styles.sideCard}`} aria-labelledby="customer-membership">
            <h2 id="customer-membership"><BadgeCheck size={18} aria-hidden="true" /> Membership</h2>
            {membership && currentMembershipStatus && (
              <>
                <span className={styles.status}
                  data-tone={currentMembershipStatus === "Active" ? "green" : membership.status === "approved" ? undefined : "amber"}>
                  {currentMembershipStatus}
                </span>
                <p className={styles.itemName}>{membership.plan_name}</p>
                {membership.status === "approved" && membership.expires_on && (
                  <p>{currentMembershipStatus === "Expired" ? "Expired on" : "Expires on"} {formatDate(membership.expires_on)}</p>
                )}
              </>
            )}
            {membership === undefined && <p>Membership status couldn’t be loaded.</p>}
            {membership === null && <p>Explore member rates and benefits.</p>}
            {currentMembershipStatus === "Awaiting payment" ? (
              <Link href={membershipApplyPath} className={styles.textLink}>
                Continue membership payment <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : (
              <Link href={membership === null ? "/membership" : "/account#account-membership-heading"} className={styles.textLink}>
                {membership === null ? "View membership plans" : "View membership"} <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}
          </section>
          {pickup && (
            <section className={`panel ${styles.sideCard}`} aria-labelledby="customer-pickup">
              <h2 id="customer-pickup"><ShoppingBag size={18} aria-hidden="true" /> Pickup order</h2>
              <p className={styles.itemName}>{pickup.quantity} × {pickup.product_name}</p>
              <p>Pick up by {pickupDeadline(pickup.expires_at)}</p>
              <Link href={pickupOrderPath(pickup.product_id, pickup.id)} prefetch={false} className={styles.textLink}>
                View pickup order <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </section>
          )}
          <Link href="/order" prefetch={false} className={`${styles.textLink} ${styles.ordersLink}`}>
            My pickup orders <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      <CurrentMatches />
    </main>
  );
}
