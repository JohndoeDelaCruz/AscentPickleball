import { cache } from "react";
import { createClient } from "./supabase/server";
import { defaultVenue, type VenueResult } from "./types";

export const getVenue = cache(async (): Promise<VenueResult> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("venue_settings")
      .select("*")
      .eq("id", true)
      .single();
    if (error || !data)
      return { venue: defaultVenue, ready: false, openPlayReady: false };
    if (!("evening_hourly_rate" in data))
      return {
        venue: {
          ...defaultVenue,
          ...data,
          hourly_rate: data.hourly_rate ?? defaultVenue.hourly_rate,
          opening_hour: data.opening_hour ?? defaultVenue.opening_hour,
          closing_hour: data.closing_hour ?? defaultVenue.closing_hour,
        },
        ready: false,
        openPlayReady: false,
      };
    return {
      venue: { ...defaultVenue, ...data },
      ready: true,
      openPlayReady: "open_play_enabled" in data,
    };
  } catch {
    return { venue: defaultVenue, ready: false, openPlayReady: false };
  }
});
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, staff: false };
  const { data } = await supabase.rpc("is_staff");
  return { user, staff: data === true };
});
