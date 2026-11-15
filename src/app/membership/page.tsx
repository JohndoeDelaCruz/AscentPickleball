import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { benefitIcons } from "@/components/membership-benefit-icons";
import { getMembershipPlans, getSession, getVenueSettings } from "@/lib/data";
import { money } from "@/lib/booking";
import { membershipApplyPath } from "@/lib/membership-applications";

export const metadata: Metadata = {
  title: "Membership plans",
  description: "Explore Ascent Pickleball membership plans, prices, and player benefits.",
};

export default async function MembershipPage() {
  const [plans, venue, { role }] = await Promise.all([getMembershipPlans(), getVenueSettings(), getSession()]);
  const facebook = venue?.facebook_url;
  return (
    <main id="main" className="container membership-page">
      <div className="page-heading">
        <h1>Membership plans</h1>
        {(role === "owner" || role === "manager") && (
          <Link href="/admin/settings#venue-membership" className="text-link">
            Edit membership details <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className="membership-layout">
        {plans.map(({ id, details }) => (
          <section key={id} className="membership-join panel" aria-labelledby={`${id}-membership-price`}>
            <h2 className="eyebrow" id={`${id}-membership-price`}>{details.plan_name}</h2>
            <p className="membership-price">
              {money(details.price_cents / 100)}<span>/ {details.price_period}</span>
            </p>
            <p>{details.validity}</p>
            <div className="membership-plan-actions">
              <Link href={`${membershipApplyPath}?plan=${id}`} className="button button-lime">
                Apply for {details.plan_name} <ArrowUpRight size={18} />
              </Link>
              <a href={`#${id}-membership-benefits`} className="text-link" aria-label={`View benefits for ${details.plan_name}`}>
                View benefits <ArrowDown size={16} />
              </a>
            </div>
          </section>
        ))}
      </div>
      <p className="membership-contact-note">
        Have questions about enrollment?{" "}
        <a href={facebook || "/#visit"} target={facebook ? "_blank" : undefined} rel={facebook ? "noreferrer" : undefined} className="text-link">
          Contact the Ascent team <ArrowUpRight size={16} />
        </a>
      </p>
      <div className="membership-layout">
        {plans.map(({ id, details }) => (
          <section key={id} id={`${id}-membership-benefits`} className="membership-plan-benefits" aria-labelledby={`${id}-membership-heading`}>
            <p className="eyebrow">{details.plan_name}</p>
            <h2 className="membership-section-title" id={`${id}-membership-heading`}>{details.heading}</h2>
            <p>{details.introduction}</p>
            <div className="membership-benefits">
              {details.benefits.map(({ icon, title, description }, index) => {
                const { Icon } = benefitIcons[icon];
                return <article key={index} className="panel membership-benefit">
                  <Icon size={22} aria-hidden="true" />
                  <div><h3>{title}</h3><p>{description}</p></div>
                </article>;
              })}
            </div>
            <p className="membership-contact-note">{details.redemption}</p>
          </section>
        ))}
      </div>
      <Link href="/court-rules" className="text-link">Read the court rules <ArrowUpRight size={16} /></Link>
    </main>
  );
}
