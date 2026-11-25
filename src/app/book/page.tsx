import type { Metadata } from "next";
import { getSession, getVenue } from "@/lib/data";
import { BookingCalendar } from "@/components/booking-calendar";
import styles from "@/components/booking-calendar.module.css";
export const metadata: Metadata = { title: "Find your court" };

function readInteger(value: string | undefined) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : undefined;
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    court?: string;
    date?: string;
    play?: string;
    session?: string;
    start?: string;
    duration?: string;
    players?: string;
    review?: string;
  }>;
}) {
  const [{ venue, ready, openPlayReady }, { user }, params] = await Promise.all(
    [getVenue(), getSession(), searchParams],
  );
  return (
    <main id="main" className={`container ${styles.page}`}>
      <BookingCalendar
        venue={venue}
        ready={ready}
        openPlayReady={openPlayReady}
        initialOpenPlay={params.play === "open"}
        signedIn={Boolean(user)}
        userName={user?.user_metadata?.full_name || ""}
        initialDate={params.date}
        initialSession={readInteger(params.session)}
        initialCourt={readInteger(params.court)}
        initialHour={readInteger(params.start)}
        initialDuration={readInteger(params.duration)}
        initialPlayers={readInteger(params.players)}
        initialReview={Boolean(user) && params.review === "1"}
      />
    </main>
  );
}
