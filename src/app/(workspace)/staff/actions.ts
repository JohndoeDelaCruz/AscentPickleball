"use server";
import { z } from "zod";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema, productSchema, type Sale } from "@/lib/pos";
import { readVerifiedUser } from "@/lib/session-access";
import { bookingSchema, openPlaySchema } from "@/lib/booking";
import { bookingError } from "@/lib/customer-request";
const id = z.uuid();
const cents = z.int().min(0).max(100000000);
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("checkout"), payload: checkoutSchema }),
  z.object({ op: z.literal("product"), payload: productSchema }),
  z.object({
    op: z.literal("stock"),
    id,
    quantity: z
      .int()
      .min(-100000)
      .max(100000)
      .refine((n) => n !== 0),
    reason: z.string().trim().min(3).max(200),
  }),
  z.object({ op: z.literal("open"), amount: cents }),
  z.object({ op: z.literal("close"), id, amount: cents }),
  z.object({ op: z.literal("verify"), id, verified: z.literal(true) }),
  z.object({
    op: z.literal("reject_payment"),
    id,
    reason: z.string().trim().min(3).max(200),
    verified: z.literal(true),
  }),
  z.object({
    op: z.literal("balance"),
    id,
    method: z.enum(["cash", "gcash"]),
    reference: z.string().max(40),
    verified: z.literal(true),
  }),
  z.object({
    op: z.literal("refund"),
    id,
    method: z.enum(["cash", "gcash"]),
    reason: z.string().trim().min(3).max(200),
    restock: z.boolean(),
    verified: z.literal(true),
  }),
]);
export type PosCommand = z.infer<typeof schema>;

const walkInPayment = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cash"), reference: z.literal("") }),
  z.object({
    method: z.literal("gcash"),
    reference: z.string().trim().regex(/^[a-zA-Z0-9 -]{6,40}$/, "Enter a valid GCash transaction reference."),
  }),
]).and(z.object({
  key: id,
  verified: z.literal(true, "Confirm that you received the payment."),
  collectedCents: z.int().min(0).max(2147483647),
}));

export async function bookWalkIn(input: unknown, openPlay: boolean): Promise<{ id?: string; error?: string }> {
  const payment = walkInPayment.safeParse(input);
  if (!payment.success) return { error: payment.error.issues[0].message };
  const booking = openPlay ? openPlaySchema.safeParse(input) : bookingSchema.safeParse(input);
  if (!booking.success) return { error: booking.error.issues[0].message };
  const p = booking.data;
  const counter = payment.data;

  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await readVerifiedUser(db.auth);
    if (isAuthRetryableFetchError(authError))
      return { error: "Sign-in verification is temporarily unavailable. Try again in a moment." };
    if (authError || !user) return { error: "Please sign in again." };

    const { data, error } = await db.rpc("pos_book_walk_in", {
      p_key: counter.key, p_kind: openPlay ? "open_play" : "court", p_date: p.booking_date,
      p_name: p.customer_name, p_phone: p.customer_phone, p_start: p.start_hour ?? null,
      p_court: "court_id" in p ? p.court_id : null, p_duration: "duration" in p ? p.duration : 1,
      p_people: "participant_count" in p ? p.participant_count : 1,
      p_quantity: p.equipment_quantity ?? Number(p.equipment_rental), p_payment_option: p.payment_option,
      p_method: counter.method, p_reference: counter.reference, p_verified: counter.verified,
      p_collected_cents: counter.collectedCents,
    });
    if (error) return { error: error.code === "PGRST202"
      ? "Walk-in booking needs database migration 023. Ask a manager to apply it."
      : bookingError(error) };
    const saved = id.safeParse(data);
    if (!saved.success) return { error: "Couldn’t confirm the walk-in. Check Reservations before starting another booking." };
    revalidatePath("/staff");
    revalidatePath("/admin");
    revalidatePath("/book");
    revalidatePath("/admin/finance");
    return { id: saved.data };
  } catch {
    return { error: "Connection interrupted. Retry the same walk-in before starting another booking." };
  }
}

export async function posCommand(
  input: unknown,
): Promise<{ ok: true; receipt?: Sale } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const db = await createClient();
    const {
      data: { user },
      error: authError,
    } = await readVerifiedUser(db.auth);
    if (isAuthRetryableFetchError(authError)) {
      return { error: "Sign-in verification is temporarily unavailable. Try again in a moment." };
    }
    if (authError || !user) return { error: "Please sign in again." };
    const c = parsed.data;
    // The close RPC verifies ownership even during a change of cashier duty.
    if (c.op !== "close") {
      const { data: allowed } = await db.rpc("is_club_staff");
      if (!allowed) return { error: "Staff tools are available to the cashier assigned for today." };
    }
    let rpc: string;
    let args: Record<string, unknown>;
    switch (c.op) {
      case "checkout":
        rpc = "pos_checkout";
        args = { p_request: c.payload };
        break;
      case "product":
        rpc = "pos_save_product";
        args = { p_product: c.payload };
        break;
      case "stock":
        rpc = "pos_adjust_stock";
        args = { p_product: c.id, p_quantity: c.quantity, p_reason: c.reason };
        break;
      case "open":
        rpc = "pos_open_shift";
        args = { p_opening: c.amount };
        break;
      case "close":
        rpc = "pos_close_shift";
        args = { p_shift: c.id, p_counted: c.amount };
        break;
      case "verify":
        rpc = "pos_verify_booking";
        args = { p_booking: c.id };
        break;
      case "reject_payment":
        rpc = "pos_reject_booking_payment";
        args = { p_booking: c.id, p_reason: c.reason };
        break;
      case "balance":
        rpc = "pos_collect_balance";
        args = {
          p_booking: c.id,
          p_method: c.method,
          p_reference: c.reference,
        };
        break;
      case "refund":
        rpc = "pos_refund";
        args = {
          p_sale: c.id,
          p_method: c.method,
          p_reason: c.reason,
          p_restock: c.restock,
        };
        break;
    }
    const { data, error } = await db.rpc(rpc, args);
    if (error) {
      const match = error.message.match(/(?:POS|Booking):\s*([\s\S]+)/);
      return {
        error: match?.[1] ?? (c.op === "open" || c.op === "close"
          ? "The shift could not be updated. Refresh the register and try again."
          : c.op === "reject_payment"
          ? "The reference could not be rejected. Refresh to check the booking status before retrying."
          : "The operation could not be completed. Check database setup and your permissions. For a checkout retry, keep the same cart."),
      };
    }
    revalidatePath("/staff");
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/my-bookings/all");
    if (c.op === "close") revalidatePath("/my-bookings");
    revalidatePath("/booking/[id]", "page");
    if (c.op === "reject_payment") revalidatePath("/book");
    return {
      ok: true,
      ...(c.op === "checkout" ? { receipt: data as Sale } : {}),
    };
  } catch {
    return {
      error:
        parsed.data.op === "open" || parsed.data.op === "close"
          ? "Connection interrupted. Refresh the register to check the shift status."
          : parsed.data.op === "reject_payment"
          ? "Connection interrupted. Refresh to check the booking status before retrying."
          : "Connection interrupted. Retry the same checkout to check its saved result before starting another sale.",
    };
  }
}
