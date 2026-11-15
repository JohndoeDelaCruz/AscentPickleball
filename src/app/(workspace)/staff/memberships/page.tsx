import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MembershipReviewTable } from "@/components/membership-review-table";
import { MembershipSale } from "@/components/membership-sale";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
import { getMembershipPlans, getSession, getVenueSettings } from "@/lib/data";
import { membershipReviewHref, membershipReviewPageSize, membershipReviewPath, type MembershipReviewRow } from "@/lib/membership-applications";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Memberships", robots: { index: false, follow: false } };

export default async function MembershipReviewPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const { user, staff, verificationUnavailable } = await getSession();
  if (verificationUnavailable) throw new Error("Unable to verify the staff session. Please try again.");
  if (!user) redirect(`/login?next=${membershipReviewPath}`);
  if (!staff) redirect("/my-bookings");
  const params = await searchParams;
  const reviewed = params.view === "reviewed";
  const requested = Number(params.page);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 2147483647 ? requested : 1;
  const db = await createClient();
  const [{ data, error }, plans, venue] = await Promise.all([
    db.rpc("list_membership_applications", { p_reviewed: reviewed, p_page: page }),
    getMembershipPlans(),
    getVenueSettings(),
  ]);
  const result = data as { row_count: number; rows: MembershipReviewRow[] } | null;
  if (!error && result && page > 1 && (page - 1) * membershipReviewPageSize >= result.row_count)
    redirect(membershipReviewHref(reviewed));

  const salePlans = plans.flatMap(({ id, details, revision }) => revision !== null && details.price_cents > 0
    ? [{ id, name: details.plan_name, price: details.price_cents, revision }] : []);
  const gcashName = venue?.gcash_name?.trim();
  const gcashNumber = venue?.gcash_number?.trim();
  const gcash = gcashName && (gcashNumber || venue?.gcash_qr_url?.trim())
    ? [gcashName, gcashNumber].filter(Boolean).join(" · ") : null;
  return <>
    <WorkspacePageHeading title="Memberships" actions={<MembershipSale plans={salePlans} gcash={gcash} />} />
    <nav className="membership-review-filters" aria-label="Membership application views">
      <Link className={`button button-small ${reviewed ? "button-outline" : "button-dark"}`} href={membershipReviewHref(false)}
        aria-current={reviewed ? undefined : "page"}>Pending verification</Link>
      <Link className={`button button-small ${reviewed ? "button-dark" : "button-outline"}`} href={membershipReviewHref(true)}
        aria-current={reviewed ? "page" : undefined}>Reviewed</Link>
    </nav>
    {error || !result ? <p className="error-message" role="alert">Membership applications couldn’t be loaded. Check that migration 033 is applied, then refresh.</p>
      : <MembershipReviewTable rows={result.rows} count={result.row_count} page={page} reviewed={reviewed} />}
  </>;
}
