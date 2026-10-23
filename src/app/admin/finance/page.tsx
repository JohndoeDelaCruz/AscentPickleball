import { redirect } from "next/navigation";
import { getSession } from "@/lib/data";
import { reportPeriod } from "@/lib/finance";
import {
  readFinanceMonth,
  readFinanceDayNotes,
  readFinanceBookings,
} from "@/lib/finance-data";
import { FinanceDashboard } from "@/components/finance-dashboard";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string; page?: string }>;
}) {
  const { user, staff } = await getSession();
  if (!user) redirect("/login?next=/admin/finance");
  if (!staff) redirect("/my-bookings");
  const params = await searchParams;
  const period = reportPeriod(params.month, params.date);
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1)) | 0;
  try {
    // Expiration runs before reading the daily log so both views agree.
    const days = await readFinanceMonth(period.month);
    const [notes, { bookings, count }] = await Promise.all([
      readFinanceDayNotes(period.date),
      readFinanceBookings(period.date, page),
    ]);
    return (
      <FinanceDashboard
        key={`${period.date}:${page}`}
        period={period}
        days={days}
        notes={notes}
        bookings={bookings}
        count={count}
        page={page}
      />
    );
  } catch {
    return (
      <div className="error-message" role="alert">
        Finance reports couldn’t be loaded. Please refresh and try again.
      </div>
    );
  }
}
