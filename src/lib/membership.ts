import { z } from "zod";
import { money } from "./booking";

export const maxMembershipPrice = 100_000;
export const maxMembershipBenefits = 16;
export const membershipTextLimits = { title: 80, period: 24, body: 500 };
export const membershipBenefitIcons = ["trophy", "wallet", "users", "calendar", "check", "heart", "gift", "coaching"] as const;
export const membershipPlanIds = ["annual", "six-month"] as const;
export type MembershipPlanId = (typeof membershipPlanIds)[number];
export const membershipPlanLabels = { annual: "Annual plan", "six-month": "Six-month plan" } satisfies Record<MembershipPlanId, string>;

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

const membershipCourtDiscountSchema = z.object({
  enabled: z.boolean(),
  amountCents: z.number().int().min(1).max(maxMembershipPrice * 100),
  minHours: z.number().int().min(1).max(4),
});
export const membershipCourtDiscountStateSchema = membershipCourtDiscountSchema.extend({
  revision: z.number().int().min(0).max(2147483647),
});
export const membershipOpenPlayDiscountSchema = membershipCourtDiscountStateSchema.omit({ minHours: true }).extend({
  floorCents: z.number().int().min(1).max(maxMembershipPrice * 100),
});

export type MembershipDetails = z.infer<typeof membershipDetailsSchema>;
export type MembershipCourtDiscount = z.infer<typeof membershipCourtDiscountStateSchema>;
export type MembershipOpenPlayDiscount = z.infer<typeof membershipOpenPlayDiscountSchema>;
export type MembershipPlan = { id: MembershipPlanId; details: MembershipDetails; revision: number | null;
  courtDiscount: MembershipCourtDiscount | null;
  openPlayDiscount?: MembershipOpenPlayDiscount;
  legacyCourtRates?: { daytime: number | null; evening: number | null };
};

type MembershipBenefit = MembershipDetails["benefits"][number];
const legacyCourtDiscountBenefits = {
  annual: {
    icon: "wallet",
    title: "₱30 off longer court bookings",
    description: "Get ₱30 off the court rental total when your booking is longer than one hour. The discount applies once per booking, rather than to each additional hour.",
  },
  "six-month": {
    icon: "wallet",
    title: "₱170 evening private booking",
    description: "Pay up to ₱170 per court per hour on eligible evening private bookings while your membership is active.",
  },
} satisfies Record<MembershipPlanId, MembershipBenefit>;

export const defaultMembership: MembershipDetails = {
  price_cents: 50_000,
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
    legacyCourtDiscountBenefits.annual,
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

export const defaultSixMonthMembership: MembershipDetails = {
  price_cents: 30_000,
  plan_name: "Six-Month Membership",
  price_period: "6 months",
  heading: "Six months of more play",
  introduction: "Join Ascent for six months of member rates and perks on and off the court.",
  validity: "Valid for six months from activation. Staff will confirm your start and expiry dates when you join.",
  redemption: "Sign in to see your member rate on eligible online private court bookings. Contact the Ascent team to redeem other perks.",
  home_summary: "Member rates for open play and evening court bookings, free equipment use, and more.",
  benefits: [
    { icon: "users", title: "₱70 member open play", description: "Ask staff which open-play sessions are eligible for the ₱70 per player member rate." },
    legacyCourtDiscountBenefits["six-month"],
    { icon: "gift", title: "Birthday free play", description: "Arrange your birthday free play with the Ascent team." },
    { icon: "trophy", title: "Free equipment borrowing", description: "Borrow paddles and balls for free when you play at Ascent." },
    { icon: "coaching", title: "Discounted group training", description: "Ask staff for member rates and available group training sessions." },
    { icon: "calendar", title: "Priority access to event passes", description: "Contact staff about priority access to passes for Ascent events." },
  ],
};

export function isBuiltInCourtDiscountBenefit(plan: MembershipPlan, benefit: MembershipBenefit) {
  const legacy = legacyCourtDiscountBenefits[plan.id];
  return Boolean(plan.courtDiscount || plan.legacyCourtRates) && benefit.title === legacy.title && benefit.description === legacy.description;
}

export function isBuiltInOpenPlayDiscountBenefit(plan: MembershipPlan, benefit: MembershipBenefit) {
  return Boolean(plan.openPlayDiscount) && ["Discounted open play", "₱70 member open play"].includes(benefit.title);
}

function membershipCourtDiscountBenefits(plan: MembershipPlan): MembershipBenefit[] {
  const discount = plan.courtDiscount;
  const icon = plan.details.benefits.find((benefit) => isBuiltInCourtDiscountBenefit(plan, benefit))?.icon ?? "wallet";
  if (discount) {
    if (!discount.enabled) return [];
    const amount = money(discount.amountCents / 100);
    const minimum = discount.minHours;
    return [{ icon, title: `${amount} off private court bookings`,
      description: `Save ${amount} once per online private court booking of at least ${minimum} ${minimum === 1 ? "hour" : "hours"}.` }];
  }

  return (["daytime", "evening"] as const).flatMap((period) => {
    const cap = plan.legacyCourtRates?.[period];
    return cap == null ? [] : [{ icon, title: `Up to ${money(cap / 100)} per ${period} court hour`,
      description: `Your member rate applies automatically to eligible ${period} hours when you book a private court online.` }];
  });
}

export function publishedMembershipDetails(plan: MembershipPlan): MembershipDetails {
  const { details, courtDiscount, legacyCourtRates, openPlayDiscount } = plan;
  if (!courtDiscount && !legacyCourtRates && !openPlayDiscount) return details;
  const discounts = courtDiscount || legacyCourtRates ? membershipCourtDiscountBenefits(plan) : [];
  if (openPlayDiscount?.enabled) {
    const amount = money(openPlayDiscount.amountCents / 100);
    const floor = money(openPlayDiscount.floorCents / 100);
    discounts.push({
      icon: "users", title: `Up to ${amount} off open play`,
      description: `Save up to ${amount} on your pass for each open-play session. The discount brings the price down to no less than ${floor}. Lower-priced sessions keep their regular price.`,
    });
  }
  const benefits = [...discounts, ...details.benefits.filter((item) =>
    !isBuiltInCourtDiscountBenefit(plan, item) && !isBuiltInOpenPlayDiscountBenefit(plan, item))];
  if (plan.id === "annual") return { ...details, benefits };

  const daytime = legacyCourtRates?.daytime != null;
  const evening = legacyCourtRates?.evening != null;
  const courtOffer = courtDiscount?.enabled || (daytime && evening) ? " and private court bookings"
    : daytime ? " and daytime court bookings" : evening ? " and evening court bookings" : "";
  return { ...details, benefits,
    home_summary: details.home_summary === defaultSixMonthMembership.home_summary
      ? `Member rates for open play${courtOffer}, free equipment use, and more.` : details.home_summary,
    redemption: !courtOffer && details.redemption === defaultSixMonthMembership.redemption
      ? "Contact the Ascent team to redeem your membership perks." : details.redemption };
}
