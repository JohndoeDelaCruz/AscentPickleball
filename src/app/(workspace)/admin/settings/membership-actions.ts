"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/data";
import { membershipDetailsSchema } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";

export async function saveMembershipDetails(input: unknown, revision: number) {
  const parsed = membershipDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!Number.isInteger(revision) || revision < 0 || revision > 2147483647)
    return { error: "Reload the membership settings before saving." };

  try {
    const { role, verificationUnavailable } = await getSession();
    if (verificationUnavailable) return { error: "Sign-in verification is temporarily unavailable. Please try again." };
    if (role !== "owner" && role !== "manager") return { error: "Manager or owner access is required." };

    const db = await createClient();
    const { data, error } = await db.rpc("save_membership_details", {
      p_details: parsed.data,
      p_expected_revision: revision,
    });
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
