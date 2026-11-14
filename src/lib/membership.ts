import { z } from "zod";

export const maxMembershipPrice = 100_000;
export const maxMembershipBenefits = 16;
export const membershipTextLimits = { title: 80, period: 24, body: 500 };
export const membershipBenefitIcons = ["trophy", "wallet", "users", "calendar", "check", "heart", "gift", "coaching"] as const;

function requiredText(label: string, max: number) {
  return z.string().trim().min(1, `Enter ${label}.`).max(max, `Use up to ${max} characters for ${label}.`);
}

const benefitSchema = z.object({
  icon: z.enum(membershipBenefitIcons),
  title: requiredText("a benefit title", membershipTextLimits.title),
  description: requiredText("a benefit description", membershipTextLimits.body),
});

export const membershipDetailsSchema = z.object({
  price_cents: z.number().int().min(0).max(maxMembershipPrice * 100),
  plan_name: requiredText("a plan name", membershipTextLimits.title),
  price_period: requiredText("a price period", membershipTextLimits.period),
  heading: requiredText("a page heading", membershipTextLimits.title),
  introduction: requiredText("an introduction", membershipTextLimits.body),
  validity: requiredText("membership validity terms", membershipTextLimits.body),
  redemption: requiredText("instructions for using benefits", membershipTextLimits.body),
  home_summary: requiredText("a homepage summary", membershipTextLimits.body),
  benefits: z.array(benefitSchema).max(maxMembershipBenefits),
});

export type MembershipDetails = z.infer<typeof membershipDetailsSchema>;

export const defaultMembership: MembershipDetails = {
  price_cents: 30_000,
  plan_name: "Annual Membership",
  price_period: "year",
  heading: "A YEAR OF GOOD GAMES.",
  introduction: "Become an Ascent Pickleball member for a full year of more play, bigger savings, and member privileges.",
  validity: "Valid for one full year from activation. Staff will confirm your membership start and expiry dates when you join.",
  redemption: "Member rates and perks are arranged with staff. Contact the team before booking to redeem your benefits.",
  home_summary: "Free use of paddles and balls, member rates, social play, and a birthday perk. Enjoy a full year of Ascent benefits.",
  benefits: [
    {
      icon: "trophy",
      title: "Free equipment use",
      description: "Use pickleball paddles and balls for free as an Ascent member.",
    },
    {
      icon: "wallet",
      title: "₱30 off longer court bookings",
      description: "Get ₱30 off the court rental total when your booking is longer than one hour. The discount applies once per booking, rather than to each additional hour.",
    },
    {
      icon: "users",
      title: "Discounted open play",
      description: "Enjoy member rates for open-play sessions. Ask the team for the current member rate.",
    },
    {
      icon: "calendar",
      title: "Priority court reservations",
      description: "Contact the Ascent team to arrange priority court reservations.",
    },
    {
      icon: "check",
      title: "Exclusive court-rental discounts",
      description: "Access exclusive member offers and discounts on court rentals. Check with staff for current offers.",
    },
    {
      icon: "heart",
      title: "Free monthly social play",
      description: "Participate in monthly social play events for free and get to know the Ascent community.",
    },
    {
      icon: "gift",
      title: "A birthday-month perk",
      description: "Choose one free court hour or one free guest pass during your birthday month. Arrange your birthday perk with staff.",
    },
    {
      icon: "coaching",
      title: "Coaching discounts",
      description: "Receive exclusive member discounts on coaching sessions. Ask staff about available coaching and member pricing.",
    },
  ],
};
