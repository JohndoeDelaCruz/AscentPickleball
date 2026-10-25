import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Gift,
  Users,
  Wallet,
  CalendarDays,
  Trophy,
  Heart,
  GraduationCap,
} from "lucide-react";
import { getVenue } from "@/lib/data";

export const metadata: Metadata = {
  title: "Annual membership",
  description:
    "Join Ascent Pickleball for ₱300 a year and enjoy free equipment use, member rates, social play, and birthday benefits.",
};

const benefits = [
  {
    icon: Trophy,
    title: "Free equipment use",
    text: "Use pickleball paddles and balls for free as an Ascent member.",
  },
  {
    icon: Wallet,
    title: "₱30 off longer court bookings",
    text: "Get ₱30 off the court rental total when your booking is longer than one hour. The discount applies once per booking, rather than to each additional hour.",
  },
  {
    icon: Users,
    title: "Discounted open play",
    text: "Enjoy member rates for open-play sessions. Ask the team for the current member rate.",
  },
  {
    icon: CalendarDays,
    title: "Priority court reservations",
    text: "Contact the Ascent team to arrange priority court reservations.",
  },
  {
    icon: Check,
    title: "Exclusive court-rental discounts",
    text: "Access exclusive member offers and discounts on court rentals. Check with staff for current offers.",
  },
  {
    icon: Heart,
    title: "Free monthly social play",
    text: "Participate in monthly social play events for free and get to know the Ascent community.",
  },
  {
    icon: Gift,
    title: "A birthday-month perk",
    text: "Choose one free court hour or one free guest pass during your birthday month. Arrange your birthday perk with staff.",
  },
  {
    icon: GraduationCap,
    title: "Coaching discounts",
    text: "Receive exclusive member discounts on coaching sessions. Ask staff about available coaching and member pricing.",
  },
];

export default async function MembershipPage() {
  const { venue } = await getVenue();
  return (
    <main id="main" className="container membership-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR ASCENT COMMUNITY</span>
        <h1>A YEAR OF GOOD GAMES.</h1>
        <p>
          Become an Ascent Pickleball member for a full year of more play,
          bigger savings, and member privileges.
        </p>
      </div>
      <div className="membership-layout">
        <section aria-labelledby="membership-benefits-title">
          <h2
            className="membership-section-title"
            id="membership-benefits-title"
          >
            Your membership benefits
          </h2>
          <div className="membership-benefits">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="panel membership-benefit">
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <aside className="membership-join panel">
          <span className="eyebrow">ANNUAL MEMBERSHIP</span>
          <p className="membership-price">
            ₱300<span>/ year</span>
          </p>
          <p>
            Valid for one full year from activation. Staff will confirm your
            membership start and expiry dates when you join.
          </p>
          <a
            href={venue.facebook_url || "/#visit"}
            target={venue.facebook_url ? "_blank" : undefined}
            rel={venue.facebook_url ? "noopener noreferrer" : undefined}
            className="button button-lime"
          >
            Join membership <ArrowUpRight size={18} />
          </a>
          <p className="membership-contact-note">
            {venue.facebook_url
              ? "Message the Ascent team on Facebook to enroll and arrange payment."
              : "Contact the Ascent team to enroll and arrange payment."}
          </p>
          <p className="membership-contact-note">
            Member rates and perks are arranged with staff. Contact the team
            before booking to redeem your benefits.
          </p>
          <Link href="/court-rules" className="text-link">
            Read the court rules <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
      <p className="membership-signoff">
        Join the Ascent Pickleball community. See you on the court!
      </p>
    </main>
  );
}
