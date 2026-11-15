import { z } from "zod";
import { localDate } from "./booking";
import { membershipPlanIds, type MembershipPlanId } from "./membership";

export const membershipApplyPath = "/membership/apply";
export const membershipReviewPath = "/staff/memberships";
export const membershipReviewPageSize = 10;
export const membershipPlanIdSchema = z.enum(membershipPlanIds);
export const membershipTerms = { annual: "1 year", "six-month": "6 months" } satisfies Record<MembershipPlanId, string>;
export const membershipReferenceSchema = z.string().trim()
  .regex(/^[a-zA-Z0-9 -]{6,40}$/, "Enter a valid GCash reference number.")
  .refine((value) => value.replace(/[^a-zA-Z0-9]/g, "").length >= 6, "Enter a valid GCash reference number.");

export type MembershipApplication = {
  id: string;
  plan_id: MembershipPlanId;
  plan_name: string;
  price_cents: number;
  status: "awaiting_payment" | "pending" | "approved" | "rejected";
  gcash_name: string;
  gcash_number: string;
  gcash_qr_url: string;
  payment_reference: string | null;
  submitted_at: string | null;
  starts_on: string | null;
  expires_on: string | null;
  review_note: string | null;
};

export type MembershipReviewRow = Pick<MembershipApplication,
  "id" | "plan_name" | "price_cents" | "status" | "payment_reference" | "submitted_at" |
  "starts_on" | "expires_on" | "review_note" | "gcash_name" | "gcash_number"
> & { email: string | null; full_name: string | null; reviewed_at: string | null };

export function membershipStatus(application: Pick<MembershipApplication, "status" | "expires_on">, date = localDate()) {
  if (application.status === "approved")
    return application.expires_on && application.expires_on > date ? "Active" : "Expired";
  if (application.status === "pending") return "Pending verification";
  if (application.status === "rejected") return "Payment rejected";
  return "Awaiting payment";
}

export function membershipReviewHref(reviewed: boolean, page = 1) {
  const params = new URLSearchParams();
  if (reviewed) params.set("view", "reviewed");
  if (page > 1) params.set("page", String(page));
  return params.size ? `${membershipReviewPath}?${params}` : membershipReviewPath;
}
