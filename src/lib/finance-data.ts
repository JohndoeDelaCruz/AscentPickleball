import "server-only";
import { createClient } from "./supabase/server";
import {
  financePageSize,
  type FinanceBooking,
  type FinanceDay,
  type FinanceDayNotes,
} from "./finance";

export async function readFinanceMonth(month: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("get_finance_month", {
    p_month: `${month}-01`,
  });
  if (error) throw error;
  if (!data?.length) throw new Error("No finance summary returned.");
  return (data || []) as FinanceDay[];
}
export async function readFinanceDayNotes(
  date: string,
): Promise<FinanceDayNotes> {
  const client = await createClient();
  const { data, error } = await client
    .from("finance_day_notes")
    .select("report_date,worker_on_duty,manager_notes")
    .eq("report_date", date)
    .maybeSingle();
  if (error) throw error;
  return data || { report_date: date, worker_on_duty: "", manager_notes: "" };
}
export async function readFinanceBookings(date: string, page: number) {
  const client = await createClient();
  const { data, error, count } = await client
    .from("bookings")
    .select("*,booking_finance(payment_method,notes)", { count: "exact" })
    .eq("booking_date", date)
    .neq("status", "blocked")
    .order("start_hour")
    .order("id")
    .range((page - 1) * financePageSize, page * financePageSize - 1);
  if (error) throw error;
  return { bookings: (data || []) as FinanceBooking[], count: count || 0 };
}
export async function readAllFinanceBookings(date: string) {
  const client = await createClient();
  const bookings: FinanceBooking[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("bookings")
      .select("*,booking_finance(payment_method,notes)")
      .eq("booking_date", date)
      .neq("status", "blocked")
      .order("start_hour")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    bookings.push(...((data || []) as FinanceBooking[]));
    if (!data || data.length < 500) return bookings;
  }
}
