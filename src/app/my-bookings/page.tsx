import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CurrentMatches } from "@/components/current-matches";
import { getSession } from "@/lib/data";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookings() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/my-bookings");

  return (
    <main id="main" className="container content-page">
      <div className="page-heading">
        <h1>YOUR COURT TIME.</h1>
        <Link href="/account" className="text-link account-link">
          Account settings / Change password <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <CurrentMatches />
      <Link href="/my-bookings/all" prefetch={false} className="button button-outline button-small">
        See all bookings <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </main>
  );
}
