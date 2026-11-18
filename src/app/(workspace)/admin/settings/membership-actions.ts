"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/data";
import { membershipCourtDiscountStateSchema, membershipOpenPlayDiscountSchema, membershipDetailsSchema, type MembershipCourtDiscount, type MembershipOpenPlayDiscount, type MembershipPlanId } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";

export async function saveMembershipDetails(plan: MembershipPlanId, input: unknown, revision: number) {
  if (plan !== "annual" && plan !== "six-month") return { error: "Choose a membership plan." };
  const parsed = membershipDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!Number.isInteger(revision) || revision < 0 || revision > 2147483647)
    return { error: "Reload the membership settings before saving." };

  try {
    const { role, verificationUnavailable } = await getSession();
    if (verificationUnavailable) return { error: "Sign-in verification is temporarily unavailable. Please try again." };
    if (role !== "owner" && role !== "manager") return { error: "Manager or owner access is required." };

    const db = await createClient();
    const params = {
      p_details: parsed.data,
      p_expected_revision: revision,
    };
    const { data, error } = plan === "annual"
      ? await db.rpc("save_membership_details", params)
      : await db.rpc("save_membership_plan", { ...params, p_plan: plan });
    if (error?.message.startsWith("Membership: ")) return { error: error.message.slice("Membership: ".length) };
    if (error || typeof data !== "number") return { error: "Membership details couldn’t be saved. Please try again." };

    revalidatePath("/admin/settings");
    revalidatePath("/membership");
    revalidatePath("/");
    return { revision: data, details: parsed.data };
  } catch {
    return { error: "Membership details couldn’t be saved. Please try again." };
  }
}

export async function saveMembershipCourtDiscount(plan: MembershipPlanId, input: unknown): Promise<
  { discount: MembershipCourtDiscount } | { error: string }
> {
  if (plan !== "annual" && plan !== "six-month") return { error: "Choose a membership plan." };
  const parsed = membershipCourtDiscountStateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter valid court discount settings for this plan." };
  }

  const failed = "The court discount couldn’t be saved. Please try again.";
  try {
    const { role, verificationUnavailable } = await getSession();
    if (verificationUnavailable) return { error: "Sign-in verification is temporarily unavailable. Please try again." };
    if (role !== "owner" && role !== "manager") return { error: "Manager or owner access is required." };

    const { enabled, amountCents, minHours, revision } = parsed.data;
    const db = await createClient();
    const rpc = plan === "annual" ? "save_membership_court_discount" : "save_membership_booking_discount";
    const { data, error } = await db.rpc(rpc, { p_plan: plan, p_enabled: enabled,
      p_amount_cents: amountCents, p_min_hours: minHours, p_expected_revision: revision });
    if (error?.code === "PGRST202") return { error: `Apply migration ${plan === "annual" ? "039" : "041"} before saving court discounts.` };
    if (error?.message.startsWith("Membership: ")) return { error: error.message.slice("Membership: ".length) };
    if (error || typeof data !== "number") return { error: failed };

    revalidatePath("/admin/settings");
    revalidatePath("/membership");
    revalidatePath("/");
    revalidatePath("/book");
    return { discount: { ...parsed.data, revision: data } };
  } catch {
    return { error: failed };
  }
}

export async function saveMembershipOpenPlayDiscount(plan: MembershipPlanId, input: unknown): Promise<
  { discount: MembershipOpenPlayDiscount } | { error: string }
> {
  if (plan !== "annual" && plan !== "six-month") return { error: "Choose a membership plan." };
  const parsed = membershipOpenPlayDiscountSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter valid open-play discount settings." };

  const failed = "The open-play discount couldn’t be saved. Please try again.";
  try {
    const { role, verificationUnavailable } = await getSession();
    if (verificationUnavailable) return { error: "Sign-in verification is temporarily unavailable. Please try again." };
    if (role !== "owner" && role !== "manager") return { error: "Manager or owner access is required." };

    const { enabled, amountCents, floorCents, revision } = parsed.data;
    const db = await createClient();
    const { data, error } = await db.rpc("save_membership_open_play_discount", {
      p_plan: plan, p_enabled: enabled, p_amount_cents: amountCents, p_floor_cents: floorCents, p_expected_revision: revision,
    });
    if (error?.code === "PGRST202") return { error: "Apply migration 046 before saving open-play discounts." };
    if (error?.message.startsWith("Membership: ")) return { error: error.message.slice("Membership: ".length) };
    if (error || typeof data !== "number") return { error: failed };
    for (const path of ["/admin/settings", "/membership", "/", "/book"]) revalidatePath(path);
    return { discount: { ...parsed.data, revision: data } };
  } catch {
    return { error: failed };
  }
}
