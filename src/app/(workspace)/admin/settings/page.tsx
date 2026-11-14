import { getSession, getVenue } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { redirect } from "next/navigation";
export default async function SettingsPage() {
  const { staff, role } = await getSession();
  if (role === "cashier") redirect("/staff");
  if (!staff) return null;
  const { venue, courtsReady } = await getVenue();
  return <SettingsForm initial={venue} courtsReady={courtsReady} />;
}
