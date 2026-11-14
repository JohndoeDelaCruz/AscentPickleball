import { getMembershipSettings, getSession, getVenue } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { redirect } from "next/navigation";
export default async function SettingsPage() {
  const { staff, role } = await getSession();
  if (role === "cashier") redirect("/staff");
  if (!staff) return null;
  const canEditMembership = role === "owner" || role === "manager";
  const [{ venue, courtsReady }, membership] = await Promise.all([
    getVenue(),
    canEditMembership ? getMembershipSettings() : null,
  ]);
  return <SettingsForm initial={venue} courtsReady={courtsReady} membership={membership} />;
}
