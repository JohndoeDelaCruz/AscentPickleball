import type { Metadata } from "next";
import { redirect, RedirectType } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signupConfirmationDestination, signupConfirmationReturnPath } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; redirect_to?: string | string[] }>;
}) {
  const params = await searchParams;
  if (typeof params.token_hash !== "string" || !params.token_hash.trim()) {
    redirect("/login?error=confirmation");
  }

  async function confirmEmail(formData: FormData) {
    "use server";
    const destination = await signupConfirmationDestination(
      formData.get("token_hash"),
      formData.get("next"),
      await createClient(),
    );
    redirect(destination, RedirectType.replace);
  }

  return (
    <main id="main" className="container content-page narrow">
      <div className="page-heading">
        <h1>Confirm your email</h1>
        <p>Verify your email address to finish setting up your Ascent account.</p>
      </div>
      <form action={confirmEmail} className="panel">
        <input type="hidden" name="token_hash" value={params.token_hash} />
        <input type="hidden" name="next" value={signupConfirmationReturnPath(params.redirect_to)} />
        <button className="button button-dark" type="submit">
          Confirm and continue <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </main>
  );
}
