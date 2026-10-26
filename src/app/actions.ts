"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bookingSchema, openPlaySchema, settingsSchema } from "@/lib/booking";
import { getVenue } from "@/lib/data";
import { financeBookingSchema, financeDaySchema } from "@/lib/finance";
import { z } from "zod";
import { balancePaymentSchema } from "@/lib/payment";
import { venueSettingPatch } from "@/lib/venue-setting";
import { scheduleConfigSchema } from "@/lib/schedule";

export async function reserveCourt(input: unknown) {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await getVenue()).openPlayReady)
    return { error: "Reservations are being updated. Please check back soon." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in before reserving a court." };
  const p = parsed.data;
  const venue = (await getVenue()).venue;
  const { data, error } = await supabase.rpc(
    "schedule_config" in venue
      ? "reserve_scheduled_booking"
      : "reserve_with_payment",
    {
      p_payment_option: p.payment_option,
      p_kind: "court",
      p_rental: p.equipment_rental,
      p_court: p.court_id,
      p_date: p.booking_date,
      p_start: p.start_hour,
      p_duration: p.duration,
      p_name: p.customer_name,
      p_phone: p.customer_phone,
    },
  );
  if (error) return { error: bookingError(error) };
  revalidatePath("/book");
  revalidatePath("/my-bookings");
  revalidatePath("/admin/finance");
  return { id: data as string };
}

export async function reserveOpenPlay(input: unknown, walkIn = false) {
  const parsed = openPlaySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await getVenue()).openPlayReady)
    return { error: "Open-play reservations aren’t available yet." };
  try {
    const supabase = walkIn ? await staffClient() : await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { error: "Please sign in before reserving open-play passes." };
    const p = parsed.data;
    const venue = (await getVenue()).venue;
    const reservationRpc =
      "schedule_config" in venue
        ? "reserve_scheduled_booking"
        : "reserve_with_payment";
    if (
      reservationRpc === "reserve_scheduled_booking" &&
      p.start_hour === undefined
    )
      return { error: "Choose an open-play session." };
    const finance = walkIn ? financeBookingSchema.safeParse(input) : null;
    if (finance && !finance.success)
      return { error: finance.error.issues[0].message };
    const { data, error } = walkIn
      ? await supabase.rpc(reservationRpc, {
          p_payment_option: p.payment_option,
          p_kind: "open_play",
          p_walk_in: true,
          p_rental: p.equipment_rental,
          p_date: p.booking_date,
          ...(p.start_hour === undefined ? {} : { p_start: p.start_hour }),
          p_people: p.participant_count,
          p_name: p.customer_name,
          p_phone: p.customer_phone,
          p_method: finance!.data!.payment_method,
          p_notes: finance!.data!.finance_notes,
        })
      : await supabase.rpc(reservationRpc, {
          p_payment_option: p.payment_option,
          p_kind: "open_play",
          p_rental: p.equipment_rental,
          p_date: p.booking_date,
          ...(p.start_hour === undefined ? {} : { p_start: p.start_hour }),
          p_people: p.participant_count,
          p_name: p.customer_name,
          p_phone: p.customer_phone,
          p_walk_in: walkIn,
        });
    if (error) return { error: bookingError(error) };
    revalidatePath("/book");
    revalidatePath("/admin");
    revalidatePath("/my-bookings");
    revalidatePath("/admin/finance");
    return { id: data as string };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

function bookingError(error: { code?: string; message: string }) {
  if (error.code === "23P01")
    return "That time was just reserved. Please choose another slot.";
  if (["PGRST202", "PGRST205"].includes(error.code || ""))
    return "Reservations aren’t open yet. Please check back soon.";
  return error.message.includes("Booking:")
    ? error.message.replace("Booking: ", "")
    : "We couldn’t complete that request. Please refresh and try again.";
}

export async function submitPayment(bookingId: string, reference: string) {
  if (!/^[a-zA-Z0-9 -]{6,40}$/.test(reference.trim()))
    return { error: "Enter a valid GCash reference number (6–40 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment_reference", {
    p_booking: bookingId,
    p_reference: reference.trim(),
  });
  if (error) return { error: bookingError(error) };
  revalidatePath(`/booking/${bookingId}`);
  revalidatePath("/my-bookings");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function cancelBooking(bookingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking: bookingId,
  });
  if (error) return { error: bookingError(error) };
  revalidatePath("/my-bookings");
  revalidatePath(`/booking/${bookingId}`);
  revalidatePath("/admin/finance");
  return { success: true };
}

async function staffClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");
  const { data } = await supabase.rpc("is_staff");
  if (!data) throw new Error("Staff access is required.");
  return supabase;
}

export async function saveSettings(input: unknown) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await staffClient();
    const { error } = await supabase
      .from("venue_settings")
      .update(parsed.data)
      .eq("id", true);
    if (error)
      return {
        error: error.message.includes("Booking:")
          ? bookingError(error)
          : "Settings could not be saved. Apply the latest database migration, then try again.",
      };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function saveSchedule(input: unknown, expected: unknown) {
  const parsed = scheduleConfigSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const previous =
    expected === null
      ? { success: true as const, data: null }
      : scheduleConfigSchema.safeParse(expected);
  if (!previous.success)
    return { error: "Reload your saved schedule before making changes." };
  try {
    const supabase = await staffClient();
    const { error } = await supabase.rpc("save_booking_schedule", {
      p_config: parsed.data,
      p_expected: previous.data,
    });
    if (error)
      return {
        error: error.message.includes("Booking:")
          ? bookingError(error)
          : "The schedule could not be saved. Check that the latest database migration has been applied.",
      };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function saveVenueSetting(key: unknown, value: unknown) {
  try {
    const supabase = await staffClient();
    const { data: current, error: readError } = await supabase
      .from("venue_settings")
      .select("*")
      .eq("id", true)
      .single();
    if (readError || !current)
      return {
        error: "Your saved settings could not be loaded. Please try again.",
      };
    const parsed = venueSettingPatch(current, key, value);
    if (!parsed.data) return { error: parsed.error };
    const { error } = await supabase
      .from("venue_settings")
      .update(parsed.data)
      .eq("id", true)
      .select("id")
      .single();
    if (error)
      return {
        error: error.message.includes("Booking:")
          ? bookingError(error)
          : "This setting could not be applied. Please try again.",
      };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function staffSetStatus(
  id: string,
  status: "confirmed" | "cancelled",
) {
  if (!["confirmed", "cancelled"].includes(status))
    return { error: "Invalid booking status." };
  try {
    const supabase = await staffClient();
    const { error } = await supabase.rpc("staff_update_booking", {
      p_booking: id,
      p_status: status,
    });
    if (error) return { error: bookingError(error) };
    revalidatePath("/admin");
    revalidatePath("/my-bookings");
    revalidatePath(`/booking/${id}`);
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function staffCreateBooking(input: unknown, blocked: boolean) {
  const parsed = (
    blocked ? bookingSchema.omit({ customer_phone: true }) : bookingSchema
  ).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const finance = financeBookingSchema.safeParse(input);
  if (!finance.success) return { error: finance.error.issues[0].message };
  if (!(await getVenue()).openPlayReady)
    return {
      error:
        "Apply the weekend open-play database migration before adding new bookings.",
    };
  try {
    const supabase = await staffClient();
    const p = parsed.data;
    const venue = (await getVenue()).venue;
    const { error } = await supabase.rpc(
      "schedule_config" in venue
        ? "reserve_scheduled_booking"
        : "reserve_with_payment",
      {
        p_payment_option: blocked ? "full" : p.payment_option,
        p_kind: "court",
        p_walk_in: true,
        p_rental: p.equipment_rental,
        p_court: p.court_id,
        p_date: p.booking_date,
        p_start: p.start_hour,
        p_duration: p.duration,
        p_name: p.customer_name,
        p_phone: "customer_phone" in p ? p.customer_phone : "",
        p_blocked: blocked,
        p_method: finance.data.payment_method,
        p_notes: finance.data.finance_notes,
      },
    );
    if (error) return { error: bookingError(error) };
    revalidatePath("/admin");
    revalidatePath("/book");
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function staffRecordBalance(input: unknown) {
  const parsed = balancePaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await staffClient();
    const p = parsed.data;
    const { error } = await supabase.rpc("staff_record_balance", {
      p_booking: p.booking_id,
      p_method: p.payment_method,
      p_reference: p.reference,
    });
    if (error) return { error: bookingError(error) };
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/my-bookings");
    revalidatePath(`/booking/${p.booking_id}`);
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function saveFinanceDay(input: unknown) {
  const parsed = financeDaySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await staffClient();
    const p = parsed.data;
    const { error } = await supabase.rpc("staff_save_finance_day", {
      p_date: p.report_date,
      p_worker: p.worker_on_duty,
      p_notes: p.manager_notes,
    });
    if (error) return { error: bookingError(error) };
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function saveBookingFinance(input: unknown) {
  const parsed = financeBookingSchema
    .extend({ booking_id: z.uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await staffClient();
    const p = parsed.data;
    const { error } = await supabase.rpc("staff_save_booking_finance", {
      p_booking: p.booking_id,
      p_method: p.payment_method,
      p_notes: p.finance_notes,
    });
    if (error) return { error: bookingError(error) };
    revalidatePath("/admin/finance");
    return { success: true };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
