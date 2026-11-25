import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { VenueSettings } from "@/lib/types";
import styles from "./booking-calendar.module.css";

export function BookingBar({ total, selection, disabled, onContinue }: {
  total: string;
  selection: string;
  disabled?: boolean;
  onContinue: () => void;
}) {
  return <div className={styles.bookingBar} data-booking-bar>
    <div aria-live="polite">
      <strong>{total}</strong>
      <small>{selection}</small>
    </div>
    <button type="button" className="button button-dark" disabled={disabled} onClick={onContinue}>
      Continue <ArrowRight size={16} aria-hidden="true" />
    </button>
  </div>;
}

export function BookingReviewHeading({ onBack, disabled }: { onBack: () => void; disabled?: boolean }) {
  return <div>
    <button type="button" className={styles.back} onClick={onBack} disabled={disabled}>
      <ArrowLeft size={16} aria-hidden="true" /> Back to availability
    </button>
    <h1 className={styles.reviewTitle} data-booking-review-heading tabIndex={-1}>Review booking.</h1>
  </div>;
}

export function BookingPolicy({ venue, id }: { venue: VenueSettings; id: string }) {
  return <details className={styles.policy} id={id}>
    <summary>Booking &amp; cancellation policy</summary>
    <p className="small-print">{venue.cancellation_policy}</p>
    <Link href="/court-rules" target="_blank" rel="noopener noreferrer" className="text-link policy-link">
      Read the full court rules
    </Link>
    <p className="small-print">
      Unpaid holds expire after {venue.hold_minutes} minutes. Submitted payments stay pending for staff verification.
      Contact the venue if you paid after your hold expired.
    </p>
  </details>;
}
