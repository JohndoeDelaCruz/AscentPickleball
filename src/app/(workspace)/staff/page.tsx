import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/data";
import { getPosData } from "@/lib/pos-data";
import { dayKey } from "@/lib/pos";
import { isValidDate } from "@/lib/booking";
import { ClubConsole } from "@/components/club-console";
import { workspaceTab } from "@/lib/workspace";
export const metadata: Metadata = {
  title: "Club management",
  robots: { index: false, follow: false },
};
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const { user, staff } = await getSession();
  if (!user) redirect("/login?next=/staff");
  if (!staff) redirect("/my-bookings");
  const p = await searchParams;
  const date =
    isValidDate(p.date) && p.date >= "2000-01-01" && p.date <= "2100-12-31"
      ? p.date
      : dayKey();
  return <ClubConsole initial={await getPosData(date)} initialDate={date} initialTab={workspaceTab(p.tab)} />;
}
