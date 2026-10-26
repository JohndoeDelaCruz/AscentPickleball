import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getSession, getVenue } from "@/lib/data";
import { BookingCalendar } from "@/components/booking-calendar";
export const metadata: Metadata = { title: "Find your court" };
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    court?: string;
    date?: string;
    play?: string;
    session?: string;
  }>;
}) {
  const [{ venue, ready, openPlayReady }, { user }, params] = await Promise.all(
    [getVenue(), getSession(), searchParams],
  );
  return (
    <main id="main" className="container">
      <div className="page-heading">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={12} />
          <span>Book a court</span>
        </div>
        <span className="eyebrow">MAKE TIME FOR A GOOD GAME</span>
        <h1>FIND YOUR COURT.</h1>
        <p>
          Your crew, your court, your kind of game. Pick a date and find your
          time. All times are in Philippine Time.
        </p>
      </div>
      <BookingCalendar
        venue={venue}
        ready={ready}
        openPlayReady={openPlayReady}
        initialOpenPlay={params.play === "open"}
        signedIn={Boolean(user)}
        userName={user?.user_metadata?.full_name || ""}
        initialDate={params.date}
        initialSession={
          params.session !== undefined && /^\d+$/.test(params.session)
            ? Number(params.session)
            : undefined
        }
      />
    </main>
  );
}
