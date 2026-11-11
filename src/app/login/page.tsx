import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/data";
import { authRedirect } from "@/lib/redirect";
export const metadata: Metadata = { title: "Your account" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    recovery?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const recovery = params.recovery === "true";
  const { user, staff } = await getSession();
  if (user && !recovery && !params.error)
    redirect(authRedirect(params.next, staff));
  return (
    <main id="main" className="auth-section">
      <div className="auth-card">
        <AuthForm
          next={typeof params.next === "string" ? params.next : undefined}
          recovery={recovery}
          initialError={
            params.error === "access"
              ? "You’re signed in, but we couldn’t load your account access. Please try again."
              : params.error
                ? "That sign-in link couldn’t restore your session. If you just confirmed your email, try logging in below with your email and password."
                : undefined
          }
        />
      </div>
    </main>
  );
}
