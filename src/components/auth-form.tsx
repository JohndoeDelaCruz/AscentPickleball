"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authRedirect, safeRedirect } from "@/lib/redirect";
import { authCallbackUrl } from "@/lib/site-url";
import { captchaOptions, captchaTokenSchema } from "@/lib/captcha";
import { TurnstileCheck } from "./turnstile-check";
import { readStaffMembership } from "@/lib/session-access";

export function AuthForm({
  next,
  recovery = false,
  initialError = "",
}: {
  next?: string;
  recovery?: boolean;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    recovery ? "reset" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const needsCaptcha = mode !== "reset";
  const router = useRouter();
  const safeNext = safeRedirect(next, "");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (needsCaptcha && !captchaTokenSchema.safeParse(captchaToken).success) {
      setError("Complete the security check before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      async function finishSignIn() {
        let staff: boolean;
        try {
          staff = await readStaffMembership(supabase);
        } catch {
          throw new Error(
            "You’re signed in, but we couldn’t load your account access. Please try again.",
          );
        }
        router.replace(authRedirect(next, staff));
        router.refresh();
      }
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaOptions(captchaToken),
        });
        if (error) throw error;
        await finishSignIn();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            ...captchaOptions(captchaToken),
            data: { full_name: name },
            emailRedirectTo: authCallbackUrl(window.location.origin, safeNext),
          },
        });
        if (error) throw error;
        if (data.session) {
          await finishSignIn();
        } else
          setMessage(
            "Check your email to confirm your account, then come back and sign in. If you already have an account, use Log in.",
          );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          ...captchaOptions(captchaToken),
          redirectTo: authCallbackUrl(
            window.location.origin,
            "/login?recovery=true",
          ),
        });
        if (error) throw error;
        setMessage(
          "If an account exists for that email, we’ve sent a password reset link.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await finishSignIn();
      }
    } catch (err) {
      setError(
        (err as { code?: string }).code === "captcha_failed"
          ? "The security check couldn’t be verified. Please try again."
          : (err as Error).message || "Something went wrong. Please try again.",
      );
    } finally {
      if (needsCaptcha) {
        setCaptchaToken("");
        setCaptchaRevision((value) => value + 1);
      }
      setBusy(false);
    }
  }
  function changeMode(value: typeof mode) {
    setMode(value);
    setCaptchaToken("");
    setCaptchaRevision((revision) => revision + 1);
    setError("");
    setMessage("");
  }
  return (
    <div className="auth-form">
      <div className="auth-intro">
        <h1>
          {mode === "signup"
            ? "Create an account"
            : mode === "forgot"
              ? "Reset your password"
              : mode === "reset"
                ? "Choose a new password"
                : "Log in"}
        </h1>
        {mode === "forgot" && (
          <p>Enter your email and we’ll send a link to reset your password.</p>
        )}
      </div>
      {(mode === "login" || mode === "signup") && (
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            aria-pressed={mode === "login"}
            disabled={busy}
            onClick={() => changeMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            aria-pressed={mode === "signup"}
            disabled={busy}
            onClick={() => changeMode("signup")}
          >
            Create account
          </button>
        </div>
      )}
      <form className="auth-fields-form" onSubmit={submit}>
        <div className="auth-fields">
          {mode === "signup" && (
            <label className="field">
              <span>Full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Your full name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              <span>{mode === "reset" ? "New password" : "Password"}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "Your password"
                }
                required
                minLength={mode === "login" ? 1 : 8}
                maxLength={128}
              />
            </label>
          )}
        </div>
        {needsCaptcha && (
          <TurnstileCheck
            key={mode}
            action={mode === "forgot" ? "password_reset" : mode}
            revision={captchaRevision}
            onToken={setCaptchaToken}
          />
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}
        <button
          className="button button-dark"
          disabled={busy || (needsCaptcha && !captchaToken)}
        >
          {busy
            ? "One moment…"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : mode === "reset"
                  ? "Update password"
                  : "Log in"}
        </button>
      </form>
      {(mode === "login" || mode === "forgot") && (
        <div className="auth-bottom">
          <button
            type="button"
            disabled={busy}
            onClick={() => changeMode(mode === "login" ? "forgot" : "login")}
          >
            {mode === "login" ? "Forgot password?" : "Back to log in"}
          </button>
        </div>
      )}
      {mode === "signup" && (
        <p className="small-print auth-privacy">
          By creating an account, you agree to our{" "}
          <Link href="/privacy" style={{ textDecoration: "underline" }}>
            privacy policy
          </Link>
          . We use your details to manage your reservations.
        </p>
      )}
    </div>
  );
}
