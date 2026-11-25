import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
} from "lucide-react";
import { getMembershipPlans, getVenue } from "@/lib/data";
import { getCounterProducts } from "@/lib/counter-products";
import { publishedMembershipDetails } from "@/lib/membership";
import { activeCourts, courtPhoto } from "@/lib/courts";
import { Starburst } from "@/components/starburst";
import { CounterProductCard } from "@/components/counter-product-card";
import { LandingMotion } from "@/components/landing-motion";
import { ScheduleOverview } from "@/components/schedule-overview";
import { HomePlaySelector } from "@/components/home-play-selector";
import {
  canBook,
  formatHour,
  money,
  getRatePeriods,
  localDate,
  equipmentPackageLabel,
} from "@/lib/booking";
import styles from "./home.module.css";

export default async function Home() {
  const [{ venue, ready }, membershipPlans, products] = await Promise.all([getVenue(), getMembershipPlans(), getCounterProducts()]);
  const courts = activeCourts(venue.courts);
  const open = ready && canBook(venue);
  const today = localDate();
  const showOpenPlay = venue.schedule_config
    ? venue.schedule_config.weekly.some((block) => block.kind === "open_play") ||
      venue.schedule_config.overrides.some((period) =>
        period.end_date >= today && period.blocks.some((block) => block.kind === "open_play"))
    : venue.open_play_enabled;
  const ratePeriods = getRatePeriods(venue);
  const faqs = [
    [
      "How do I reserve a court?",
      "Choose your date, court, and time on our booking page. Sign in to reserve, then follow the GCash instructions. Staff will confirm your booking after checking your payment.",
    ],
    [
      "How do GCash payments work?",
      "Choose a 50% reservation fee or full payment, then pay the amount shown using our GCash QR and submit your reference before your hold expires. Staff verifies the payment before confirming your booking. If you choose the reservation fee, settle the remaining balance at the venue before you play.",
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
    <LandingMotion>
      <section className={styles.hero} aria-labelledby="home-title" data-landing-hero>
        <div className={styles.heroVisual}>
          <div className={styles.heroPhoto} data-hero-photo>
            <Image src="/ascent-courts-panorama.jpg"
              alt="Ascent Pickleball’s two gray and red courts surrounded by trees"
              unoptimized fill sizes="100vw" loading="eager" fetchPriority="high"
              className={styles.heroImage} data-hero-image />
          </div>
        </div>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-title" data-hero="">
              <span>Play higher.</span>{" "}
              <span>Play <em>Ascent.</em></span>
            </h1>
            {venue.city && <p data-hero="">{venue.city}</p>}
            <div className={styles.heroActions} data-hero="">
              <Link href="/book" className="button button-lime">
                {open ? "Book a court" : "Explore the calendar"} <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
              {showOpenPlay && (
                <Link href="/book?play=open" className={`button ${styles.secondaryAction}`}>
                  {open ? "Join open play" : "Explore open play"} <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className={`container ${styles.scheduleWrap}`}>
        <ScheduleOverview venue={venue} ready={ready} date={today} courtCount={courts.length} />
      </div>
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
                  PLAY MORE <Starburst className="marquee-star" /> CONNECT MORE{" "}
                  <Starburst className="marquee-star" /> RISE TOGETHER{" "}
                  <Starburst className="marquee-star" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <HomePlaySelector showOpenPlay={showOpenPlay} />
      <section className={`container ${styles.courts}`} id="courts">
        <div className="section-heading" data-reveal="">
          <div>
            <h2>The courts.</h2>
          </div>
        </div>
        <div className="court-cards">
          {courts.map(({ id: court, name }) => (
            <Link
              href={`/book?court=${court}`}
              className="court-card"
              aria-labelledby={`court-${court}-title`}
              data-reveal=""
              key={court}
            >
              <Image
                src={courtPhoto(court)}
                alt=""
                fill
                sizes="(max-width: 650px) calc(100vw - 40px), (max-width: 1280px) 50vw, 627px"
              />
              <div className="court-card-copy">
                <div>
                  <h3 id={`court-${court}-title`}><span className="sr-only">Book </span>{name}</h3>
                  {venue.schedule_config ? (
                    <p>Private hours and rates vary by day. Choose a date to see availability.</p>
                  ) : (
                    <dl className="court-rates">
                      {ratePeriods.map((period) => (
                        <div key={period.start}>
                          <dt>
                            {formatHour(period.start)} –{" "}
                            {formatHour(period.end)}
                          </dt>
                          <dd>
                            <strong>{money(period.rate)}</strong> / hour
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p>
                    Optional rental: {money(venue.equipment_rental_price)} ·{" "}
                    {equipmentPackageLabel(venue.equipment_ball_count)}
                  </p>
                  <p>
                    {venue.schedule_config
                      ? "Player limits are listed for each booking period."
                      : `Up to ${venue.private_court_capacity} players per private court.`}
                  </p>
                </div>
                <span className="circle-arrow" aria-hidden="true">
                  <ArrowUpRight size={22} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!courts.length && <p>No active courts are listed.</p>}
      </section>
      <section
        className="container membership-home"
        aria-labelledby="membership-home-title"
        data-reveal=""
      >
        <div>
          <h2 id="membership-home-title">Membership plans</h2>
          <ul className="membership-home-plans">
            {membershipPlans.map((plan) => {
              const details = publishedMembershipDetails(plan);
              return <li key={plan.id}>
                <strong>{details.plan_name} · {money(details.price_cents / 100)} / {details.price_period}</strong>
                <p>{details.home_summary}</p>
              </li>;
            })}
          </ul>
        </div>
        <Link href="/membership" className="button button-lime">
          View membership benefits <ArrowUpRight size={18} />
        </Link>
      </section>
      {products.length > 0 && (
        <section className={`container ${styles.counter}`} aria-labelledby="counter-heading" data-reveal="">
          <h2 id="counter-heading">At the counter.</h2>
          <CounterProductCard products={products} />
        </section>
      )}
      <section className="visit-section" id="visit">
        <div className="container visit-grid">
          <div data-reveal="">
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
          <div className="visit-art" aria-hidden="true" data-reveal="">
            <Image
              src="/pickleball-equipment.jpg"
              alt=""
              fill
              sizes="(max-width: 650px) calc(100vw - 40px), (max-width: 1100px) 45vw, 560px"
              className="visit-photo"
            />
            <span className="visit-word">
              MEET YOU
              <br />
              AT THE NET.
            </span>
          </div>
        </div>
      </section>
      <section className="container section faq-section" id="faq">
        <div data-reveal="">
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
        <div className="faq-list" data-reveal="">
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
        <div className="container" data-reveal="">
          <h2>
            THE NEXT RALLY
            <br />
            STARTS WITH YOU
          </h2>
          <Link href="/book" className="button button-dark">
            Let’s get playing <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </LandingMotion>
  );
}
