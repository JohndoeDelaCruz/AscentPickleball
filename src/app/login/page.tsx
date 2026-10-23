import type { Metadata } from "next";
import Image from "next/image";
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
      <div className="auth-art">
        <Image
          src="/ascent-courts-panorama.jpg"
          alt="Ascent Pickleball’s two gray and red courts surrounded by trees"
          unoptimized
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 850px) 100vw, 50vw"
        />
        <div className="auth-art-copy">
          <span className="eyebrow">GOOD GAMES. GREAT COMPANY.</span>
          <h2>
            FIND YOUR
            <br />
            NEXT RALLY.
          </h2>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form-content">
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
      </div>
    </main>
  );
}
