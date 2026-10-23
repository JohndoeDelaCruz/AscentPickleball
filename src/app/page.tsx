import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  MapPin,
  MoveUpRight,
  QrCode,
  CalendarDays,
} from "lucide-react";
import { getVenue } from "@/lib/data";
import { canBook, formatHour, money, getRatePeriods } from "@/lib/booking";

export default async function Home() {
  const { venue } = await getVenue();
  const open = canBook(venue);
  const ratePeriods = getRatePeriods(venue);
  const faqs = [
    [
      "How do I reserve a court?",
      "Choose your date, court, and time on our booking page. Sign in to reserve, then follow the GCash instructions. Staff will confirm your booking after checking your payment.",
    ],
    [
      "How do GCash payments work?",
      "Pay the exact booking amount using our GCash QR, then submit your payment reference before your hold expires. Your booking stays under review until staff verifies the incoming payment.",
    ],
    ["Can I cancel my reservation?", venue.cancellation_policy],
    [
      "Can I book more than one hour?",
      "Yes. Once reservations open, you can choose one to four consecutive hours, subject to court availability. The total is shown before you reserve.",
    ],
    [
      "When can I start booking?",
      open
        ? "Reservations are open! You can browse available times up to 30 days ahead. All times are in Philippine Time."
        : "Our court hours and rates are listed above. Online reservations will open once we finish getting everything ready.",
    ],
  ];
  return (
    <main id="main">
      <section className="container hero">
        <div className="hero-copy">
          <h1>
            PLAY HIGHER.
            <br />
            <span className="hero-ascent">
              PLAY <span className="text-outline">ASCENT.</span>
              <svg viewBox="0 0 410 20" aria-hidden="true">
                <path
                  d="M3 13Q190-3 405 9M35 19Q220 4 380 13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="hero-description">
            A place to play, a reason to connect. Get your crew together and
            make your next game an Ascent game.
          </p>
          <div className="hero-buttons">
            <Link href="/book" className="button button-dark">
              Find your court <ArrowUpRight size={19} />
            </Link>
            <a href="#courts" className="text-link">
              Meet Ascent <ArrowDown size={16} />
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/ascent-courts-panorama.jpg"
            alt="Ascent Pickleball’s two gray and red courts surrounded by trees"
            unoptimized
            fill
            sizes="(max-width: 650px) calc(100vw - 40px), (max-width: 1100px) calc(100vw - 64px), 1280px"
            loading="eager"
            fetchPriority="high"
            className="hero-art"
          />
          <div className="visual-top">
            <span className="hero-coordinates">
              PHILIPPINES
              <br />
              FOR THE LOVE OF PLAY
            </span>
          </div>
          <div className="vertical-word">LET’S PLAY.</div>
          <div className="hero-image-caption">
            <span className="caption-circle">
              <MoveUpRight size={30} />
            </span>
            <div>
              <strong>
                Find your people.
                <br />
                Find your game.
              </strong>
              <span>WELCOME TO YOUR NEXT CHAPTER</span>
            </div>
          </div>
        </div>
      </section>
      <div
        className="marquee-band"
        aria-label="Play more. Connect more. Rise together."
        role="region"
        tabIndex={0}
      >
        <div className="marquee-track" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div className="marquee-group" key={copy}>
              {[0, 1].map((repeat) => (
                <div className="marquee-phrase" key={repeat}>
                  PLAY MORE <span>✳</span> CONNECT MORE <span>✳</span> RISE
                  TOGETHER <span>✳</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <section className="container section courts-section" id="courts">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR SPACE TO PLAY</span>
            <h2>
              TWO COURTS.
              <br />
              MAKE THEM YOURS.
            </h2>
          </div>
        </div>
        <div className="court-cards">
          {[1, 2].map((court) => (
            <Link
              href={`/book?court=${court}`}
              className="court-card"
              key={court}
            >
              <div className={`court-card-art court-art-${court}`}>
                <Image
                  src={`/court-${court}.jpg`}
                  alt={`Ascent Pickleball Court ${court}`}
                  fill
                  loading="eager"
                  sizes="(max-width: 700px) 100vw, 50vw"
                />
                <span className="court-number">0{court}</span>
              </div>
              <div className="court-card-copy">
                <div>
                  <h3>Court {court}</h3>
                  <dl className="court-rates">
                    {ratePeriods.map((period) => (
                      <div key={period.start}>
                        <dt>
                          {formatHour(period.start)} – {formatHour(period.end)}
                        </dt>
                        <dd>
                          <strong>{money(period.rate)}</strong> / hour
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="court-rental">
                    Optional rental: {money(venue.equipment_rental_price)} · 1
                    paddle + 2 balls
                    <br />
                    <span>Not included in the court rate.</span>
                  </p>
                </div>
                <span className="circle-arrow">
                  <ArrowUpRight size={22} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        {venue.open_play_enabled && (
          <div className="weekend-home-callout">
            <div>
              <span className="eyebrow">SATURDAY & SUNDAY</span>
              <h3>More rallies. One open-play pass.</h3>
              <p>
                {formatHour(venue.open_play_start_hour)}–
                {formatHour(venue.open_play_end_hour)} ·{" "}
                {money(venue.open_play_price)} per person ·{" "}
                {venue.open_play_capacity === null
                  ? "No player limit"
                  : `${venue.open_play_capacity} players per day`}
                . Share both courts and rotate throughout the session.
              </p>
              <p className="small-print">
                Weekend private court bookings:{" "}
                {formatHour(venue.opening_hour ?? 6)}–
                {formatHour(venue.weekend_court_end_hour)} and{" "}
                {formatHour(venue.open_play_end_hour)}–
                {formatHour(venue.closing_hour ?? 22)}.
              </p>
            </div>
            <Link className="button button-dark" href="/book?play=open">
              Join weekend open play <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="booking-callout">
        <div className="container callout-inner">
          <div>
            <span className="eyebrow">LESS PLANNING. MORE PLAYING.</span>
            <h2>
              YOUR COURT TIME
              <br />
              IS CALLING.
            </h2>
            <p>
              {open
                ? "Pick your time. Round up your crew. We’ll see you on court."
                : "We’re getting ready for you. Explore the booking calendar while we put the finishing touches in place."}
            </p>
            <Link href="/book" className="button button-lime">
              {open ? "Book your next game" : "Explore the calendar"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="callout-details">
            <div>
              <CalendarDays />
              <span>
                THE COURTS<strong>Two courts. Your choice.</strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                COURT HOURS
                <strong>
                  {ratePeriods.length
                    ? ratePeriods.map((period) => (
                        <span className="court-hours-line" key={period.start}>
                          {formatHour(period.start)} – {formatHour(period.end)}
                        </span>
                      ))
                    : "Coming soon"}
                </strong>
              </span>
            </div>
            <div>
              <QrCode />
              <span>
                KEEP IT SIMPLE<strong>GCash. Checked by our team.</strong>
              </span>
            </div>
            <div className="callout-status">
              <span className="live-dot" />
              {open ? "Reservations are open" : "Reservations opening soon"}
            </div>
          </div>
        </div>
      </section>
      <section className="container section" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FROM LET’S PLAY TO GAME ON</span>
            <h2>
              THREE STEPS.
              <br />
              THEN YOU’RE ON.
            </h2>
          </div>
          <Link href="/book" className="text-link">
            Find a time <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="steps">
          <article>
            <span className="step-number">
              01 <CalendarDays size={23} />
            </span>
            <h3>Pick your play.</h3>
            <p>
              Find a date, choose a court, and grab a time that works for your
              crew.
            </p>
          </article>
          <article>
            <span className="step-number">
              02 <QrCode size={23} />
            </span>
            <h3>Make it yours.</h3>
            <p>
              Reserve your slot, pay through our GCash QR, and send your
              reference number.
            </p>
          </article>
          <article>
            <span className="step-number">
              03 <Check size={25} />
            </span>
            <h3>Show up. Play on.</h3>
            <p>
              Once our team confirms your payment, your court is ready for your
              next great game.
            </p>
          </article>
        </div>
      </section>
      <section className="visit-section" id="visit">
        <div className="container visit-grid">
          <div>
            <span className="eyebrow">A NEW PLACE TO CONNECT</span>
            <h2>
              SEE YOU
              <br />
              AT ASCENT.
            </h2>
            <p>{venue.tagline}</p>
            <div className="visit-address">
              <MapPin size={22} />
              <div>
                <strong>{venue.city || "Philippines"}</strong>
                <span>
                  {venue.address ||
                    "Our exact location will be announced here soon."}
                </span>
              </div>
            </div>
            {venue.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.address} ${venue.city}`)}`}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Get directions <ArrowUpRight size={17} />
              </a>
            )}
            {venue.phone && (
              <p>
                <a href={`tel:${venue.phone}`}>{venue.phone}</a>
              </p>
            )}
            {venue.facebook_url && (
              <a
                href={venue.facebook_url}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Find us on Facebook <ArrowUpRight size={17} />
              </a>
            )}
          </div>
          <div className="visit-art" aria-hidden="true">
            <div className="visit-court">
              <span />
              <span />
            </div>
            <span className="visit-ball">✳</span>
            <span className="visit-word">
              MEET YOU
              <br />
              AT THE NET.
            </span>
          </div>
        </div>
      </section>
      <section className="container section faq-section" id="faq">
        <div>
          <span className="eyebrow">A FEW THINGS TO KNOW</span>
          <h2>
            GOOD QUESTIONS.
            <br />
            STRAIGHT ANSWERS.
          </h2>
          {venue.email && (
            <a href={`mailto:${venue.email}`} className="text-link">
              Ask our team <ArrowUpRight size={17} />
            </a>
          )}
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="last-call">
        <div className="container">
          <h2>
            THE NEXT RALLY
            <br />
            STARTS WITH YOU<span>↗</span>
          </h2>
          <Link href="/book" className="button button-dark">
            Let’s get playing <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
