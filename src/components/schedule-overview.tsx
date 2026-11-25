import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { addDays, formatDate, formatHour, money } from "@/lib/booking";
import { legacySchedule, resolveSchedule } from "@/lib/schedule";
import type { VenueSettings } from "@/lib/types";
import { ScheduleRows } from "./schedule-rows";
import styles from "@/app/home.module.css";

export function ScheduleOverview({ venue, ready, date, courtCount }: {
  venue: VenueSettings;
  ready: boolean;
  date: string;
  courtCount: number;
}) {
  const config = ready ? venue.schedule_config ?? legacySchedule(venue) : null;
  const day = config ? resolveSchedule({ ...venue, schedule_config: config }, date) : null;
  const active = config?.overrides.find((period) => period.id === day?.override?.id);
  const upcoming = config?.overrides
    .filter((period) => period.start_date > date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const blocks = day?.blocks ?? [];
  const openPlayOnly = blocks.length > 0 && blocks.every((block) => block.kind === "open_play");

  return (
    <section id="play-schedule" className={`panel public-schedule ${styles.schedule}`} aria-labelledby="home-schedule-title">
      <div className={styles.scheduleHeading}>
        <div>
          <h2 id="home-schedule-title">Today’s play schedule</h2>
          <p><time dateTime={date}>{formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</time> · Philippine time</p>
        </div>
        <Link href={`/book?date=${date}${openPlayOnly ? "&play=open" : ""}`} className="button button-dark button-small">
          View availability <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {active && (
        <p className={styles.scheduleNotice}>
          <strong>{active.name}</strong> · Regular hours resume {formatDate(addDays(active.end_date, 1), { month: "short", day: "numeric" })}.
        </p>
      )}
      {!config || courtCount === 0 || blocks.length === 0 ? (
        <p className={styles.scheduleEmpty}>
          {!config ? "Venue hours will appear here when the schedule is available."
            : courtCount === 0 ? "No active courts are available today." : "No sessions are scheduled today."}
        </p>
      ) : (
        <ul className={styles.scheduleList}>
          {blocks.map((block) => (
            <li key={block.id}>
              <span>{block.kind === "court" ? "Private court" : "Open play"}</span>
              <strong>{formatHour(block.start)}–{formatHour(block.end)}</strong>
              <span>{money(block.rate)} <small>{block.kind === "court" ? "/ court / hour" : "/ person"}</small></span>
            </li>
          ))}
        </ul>
      )}
      {active && active.start_date !== active.end_date && (
        <details>
          <summary>{active.name} · {formatDate(active.start_date)}–{formatDate(active.end_date)}</summary>
          <ScheduleRows blocks={active.blocks} courtCount={courtCount} label={active.name} />
        </details>
      )}
      {config && (
        <details>
          <summary>Regular weekly schedule</summary>
          <ScheduleRows blocks={config.weekly} courtCount={courtCount} label="Regular weekly schedule" />
        </details>
      )}
      {upcoming && (
        <details>
          <summary>{upcoming.name} · {formatDate(upcoming.start_date)}–{formatDate(upcoming.end_date)}</summary>
          <ScheduleRows blocks={upcoming.blocks} courtCount={courtCount} label={upcoming.name} />
        </details>
      )}
    </section>
  );
}
