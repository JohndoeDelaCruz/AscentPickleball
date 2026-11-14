import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { benefitIcons } from "@/components/membership-benefit-icons";
import { getMembershipSettings, getSession, getVenueSettings } from "@/lib/data";
import { money } from "@/lib/booking";

export async function generateMetadata(): Promise<Metadata> {
  const { details } = await getMembershipSettings();
  return { title: details.plan_name, description: details.home_summary };
}

export default async function MembershipPage() {
  const [{ details }, venue, { role }] = await Promise.all([getMembershipSettings(), getVenueSettings(), getSession()]);
  const facebook = venue?.facebook_url;
  return (
    <main id="main" className="container membership-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR ASCENT COMMUNITY</span>
        <h1>{details.heading}</h1>
        <p>{details.introduction}</p>
        {(role === "owner" || role === "manager") && (
          <Link href="/admin/settings#venue-membership" className="text-link">
            Edit membership details <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className="membership-layout">
        {details.benefits.length > 0 && (
          <section aria-labelledby="membership-benefits-title">
            <h2 className="membership-section-title" id="membership-benefits-title">
              Your membership benefits
            </h2>
            <div className="membership-benefits">
              {details.benefits.map(({ icon, title, description }, index) => {
                const { Icon } = benefitIcons[icon];
                return <article key={index} className="panel membership-benefit">
                  <Icon size={24} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>;
              })}
            </div>
          </section>
        )}
        <aside className="membership-join panel">
          <span className="eyebrow">{details.plan_name}</span>
          <p className="membership-price">
            {money(details.price_cents / 100)}<span>/ {details.price_period}</span>
          </p>
          <p>{details.validity}</p>
          <a
            href={facebook || "/#visit"}
            target={facebook ? "_blank" : undefined}
            rel={facebook ? "noopener noreferrer" : undefined}
            className="button button-lime"
          >
            Join membership <ArrowUpRight size={18} />
          </a>
          <p className="membership-contact-note">
            {facebook
              ? "Message the Ascent team on Facebook to enroll and arrange payment."
              : "Contact the Ascent team to enroll and arrange payment."}
          </p>
          <p className="membership-contact-note">{details.redemption}</p>
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
