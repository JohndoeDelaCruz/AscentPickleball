import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/data";
import { ChangePasswordForm } from "@/components/change-password-form";

export const metadata: Metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { user, staff } = await getSession();
  if (!user) redirect("/login?next=/account");
  return (
    <main id="main" className="container content-page account-page">
      <div className="page-heading">
        <h1>Account settings</h1>
        <p>{user.email}</p>
        <Link className="text-link" href={staff ? "/admin" : "/my-bookings"}>
          <ArrowLeft size={17} /> {staff ? "Back to dashboard" : "Back to my bookings"}
        </Link>
      </div>
      <ChangePasswordForm />
    </main>
  );
}
