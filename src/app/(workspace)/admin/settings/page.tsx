import { getSession, getVenue } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
export default async function SettingsPage() {
  const { staff, role } = await getSession();
  if (!staff || role === "cashier") return null;
  const { venue, courtsReady } = await getVenue();
  return <SettingsForm initial={venue} courtsReady={courtsReady} />;
}
