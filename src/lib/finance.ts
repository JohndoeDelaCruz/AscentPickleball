import { z } from "zod";
import {
  addDays,
  formatDate,
  formatHour,
  isValidDate,
  localDate,
  bookingBaseAmount,
} from "./booking";
import type { Booking } from "./types";

export const paymentMethods = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
  unspecified: "Not recorded",
} as const;
export type PaymentMethod = keyof typeof paymentMethods;
export const financePageSize = 50;
export const financeBookingSchema = z.object({
  payment_method: z
    .enum(["cash", "gcash", "bank_transfer", "card", "other", "unspecified"])
    .default("cash"),
  finance_notes: z.string().trim().max(2000).default(""),
});
export const financeDaySchema = z.object({
  report_date: z.iso
    .date()
    .refine(
      (value) => value >= "2000-01-01" && value <= "2100-12-31",
      "Choose a date from 2000 to 2100.",
    ),
  worker_on_duty: z.string().trim().max(200),
  manager_notes: z.string().trim().max(4000),
});
export type FinanceDayNotes = z.infer<typeof financeDaySchema>;
export type FinanceBooking = Booking & {
  booking_finance: { payment_method: PaymentMethod; notes: string } | null;
};
export const financeMetrics = [
  "court_1_sales",
  "court_2_sales",
  "open_play_sales",
  "total_sales",
  "court_1_hours",
  "court_2_hours",
  "open_play_players",
  "cash_sales",
  "gcash_sales",
  "bank_transfer_sales",
  "card_sales",
  "other_sales",
  "unspecified_sales",
  "pending_value",
  "confirmed_bookings",
  "equipment_sales",
] as const;
export type FinanceSummary = Record<(typeof financeMetrics)[number], number>;
export type FinanceDay = FinanceSummary & { report_date: string };
export function sumFinance(days: FinanceDay[]): FinanceSummary {
  return Object.fromEntries(
    financeMetrics.map((key) => [
      key,
      days.reduce((sum, day) => sum + Math.round(Number(day[key]) * 100), 0) /
        100,
    ]),
  ) as FinanceSummary;
}
export function isReportMonth(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === 7 &&
    /^20\d{2}-(0[1-9]|1[0-2])$|^2100-(0[1-9]|1[0-2])$/.test(value)
  );
}
export function reportPeriod(month?: string, date?: string) {
  const today = localDate();
  const selectedMonth = isReportMonth(month) ? month : today.slice(0, 7);
  const start = `${selectedMonth}-01`;
  const end = addDays(start, 32).slice(0, 7) + "-01";
  const selectedDate =
    isValidDate(date) && date.startsWith(selectedMonth)
      ? date
      : today.startsWith(selectedMonth)
        ? today
        : start;
  return { month: selectedMonth, date: selectedDate, start, end };
}
export function bookingPaymentMethod(b: FinanceBooking): PaymentMethod {
  return (
    b.booking_finance?.payment_method ?? (b.user_id ? "gcash" : "unspecified")
  );
}
export function bookingFinanceDescription(b: FinanceBooking) {
  return b.booking_type === "open_play"
    ? `Open play · ${b.participant_count} ${b.participant_count === 1 ? "player" : "players"}`
    : `Court ${b.court_id}`;
}
// Neutralize spreadsheet formulas in names/notes without changing numeric data.
export function toCsv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value);
            if (
              typeof value === "string" &&
              /^[\s\u0000-\u001f]*[=+\-@]/.test(text)
            )
              text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function monthCsv(days: FinanceDay[]) {
  const headers = [
    "Date (PHT)",
    "Court 1 sales (PHP)",
    "Court 2 sales (PHP)",
    "Open-play sales (PHP)",
    "Total confirmed sales (PHP)",
    "Court 1 hours",
    "Court 2 hours",
    "Open-play players",
    "Cash (PHP)",
    "GCash (PHP)",
    "Bank transfer (PHP)",
    "Card (PHP)",
    "Other (PHP)",
    "Not recorded (PHP)",
    "Pending value (PHP)",
    "Confirmed reservations",
    "Equipment rental sales (PHP)",
  ];
  const fields = financeMetrics;
  const totals = sumFinance(days);
  return toCsv([
    headers,
    ...days.map((d) => [d.report_date, ...fields.map((key) => Number(d[key]))]),
    ["MONTH TOTAL", ...fields.map((key) => totals[key])],
  ]);
}
export function dayCsv(bookings: FinanceBooking[], notes: FinanceDayNotes) {
  return toCsv([
    ["Play date (PHT)", notes.report_date],
    ["Worker on duty", notes.worker_on_duty],
    ["Manager notes", notes.manager_notes],
    [
      "Amounts are assigned to play date. Confirmed sales include selected equipment rental. Refunds are not tracked here.",
    ],
    [],
    [
      "Reference",
      "Play date (PHT)",
      "Court / session",
      "Customer",
      "Start (PHT)",
      "End (PHT)",
      "Private court hours",
      "Open-play players",
      "Saved average hourly rate (PHP)",
      "Court/pass subtotal (PHP)",
      "Equipment sets",
      "Equipment charge (PHP)",
      "Booking value (PHP)",
      "Confirmed sales (PHP)",
      "Payment method",
      "Status",
      "GCash reference",
      "Staff notes",
    ],
    ...bookings.map((b) => [
      b.reference,
      b.booking_date,
      bookingFinanceDescription(b),
      b.customer_name,
      formatHour(b.start_hour),
      formatHour(b.start_hour + b.duration),
      b.booking_type === "court" ? b.duration : 0,
      b.booking_type === "open_play" ? b.participant_count : 0,
      b.booking_type === "court"
        ? Math.round((bookingBaseAmount(b) * 100) / b.duration) / 100
        : "",
      bookingBaseAmount(b),
      b.equipment_rental ? 1 : 0,
      Number(b.equipment_amount || 0),
      Number(b.total_amount),
      b.status === "confirmed" ? Number(b.total_amount) : 0,
      paymentMethods[bookingPaymentMethod(b)],
      b.status,
      b.payment_reference || "",
      b.booking_finance?.notes || "",
    ]),
  ]);
}
export function monthLabel(month: string) {
  return formatDate(`${month}-01`, { month: "long", year: "numeric" });
}
