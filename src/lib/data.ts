import { cache } from "react";
import { createClient } from "./supabase/server";
import { defaultVenue, type VenueResult } from "./types";
import { defaultCourts, type Court } from "./courts";
import { readSessionAccess } from "./session-access";
import { defaultMembership, defaultSixMonthMembership, membershipDetailsSchema, membershipPlanIds, type MembershipPlan } from "./membership";
import type { MembershipApplication } from "./membership-applications";

export const getCourtInventory = cache(async () => {
  try {
  const db = await createClient();
  const { data, error } = await db.from("courts").select("*").order("id");
  if (error || !data) return { courts: defaultCourts, ready: false, loaded: false };
  return {
    courts: data.map((c) => ({ id: c.id, name: c.name, active: c.active ?? true, revision: c.revision ?? 0 })) as Court[],
    ready: data.every((c) => typeof c.active === "boolean" && typeof c.revision === "number"),
    loaded: true,
  };
  } catch { return { courts: defaultCourts, ready: false, loaded: false }; }
});

export const getVenueSettings = cache(async () => {
  try {
    const db = await createClient();
    const { data, error } = await db.from("venue_settings").select("*").eq("id", true).single();
    return error ? null : data;
  } catch {
    return null;
  }
});

export const getMembershipPlans = cache(async (): Promise<MembershipPlan[]> => {
  const fallback: MembershipPlan[] = membershipPlanIds.map((id) => ({
    id, details: id === "annual" ? defaultMembership : defaultSixMonthMembership, revision: null,
  }));
  try {
    const db = await createClient();
    const { data, error } = await db.from("membership_settings").select("id, details, revision");
    if (error || !data) return fallback;
    return fallback.map((plan) => {
      const row = data.find(({ id }) => id === (plan.id === "annual"));
      if (!row || !Number.isInteger(row.revision)) return plan;
      const parsed = membershipDetailsSchema.safeParse(row.details ?? plan.details);
      return parsed.success ? { ...plan, details: parsed.data, revision: row.revision } : plan;
    });
  } catch {
    return fallback;
  }
});

export const getVenue = cache(async (): Promise<VenueResult> => {
  const [inventory, data] = await Promise.all([getCourtInventory(), getVenueSettings()]);
  const defaults = { ...defaultVenue, courts: inventory.courts };
  if (!data)
    return { venue: defaults, ready: false, openPlayReady: false, courtsReady: inventory.ready };
  if (!("evening_hourly_rate" in data))
    return {
      venue: {
        ...defaults,
        ...data,
        hourly_rate: data.hourly_rate ?? defaultVenue.hourly_rate,
        opening_hour: data.opening_hour ?? defaultVenue.opening_hour,
        closing_hour: data.closing_hour ?? defaultVenue.closing_hour,
      },
      ready: false,
      openPlayReady: false,
    };
  return {
    venue: { ...defaults, ...data },
    ready: inventory.loaded,
    courtsReady: inventory.ready,
    openPlayReady: "open_play_enabled" in data,
  };
});
export const getSession = cache(async () => {
  return readSessionAccess(await createClient());
});

export const getWorkspaceRole = cache(async () => {
  return (await getSession()).role;
});

export const getCurrentMembership = cache(async (userId: string): Promise<MembershipApplication | null | undefined> => {
  try {
    const db = await createClient();
    const { data, error } = await db.from("membership_applications")
      .select("id, plan_id, plan_name, price_cents, status, gcash_name, gcash_number, gcash_qr_url, payment_reference, submitted_at, starts_on, expires_on, review_note")
      .eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    return error ? undefined : data as MembershipApplication | null;
  } catch {
    return undefined;
  }
});
