import { randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const turnstileOrigin = "https://challenges.cloudflare.com";
const isDevelopment = process.env.NODE_ENV === "development";

function contentSecurityPolicy(nonce: string, supabaseOrigin: string) {
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", turnstileOrigin];
  if (isDevelopment) scripts.push("'unsafe-eval'");

  // Staff can supply an HTTPS URL for the payment QR. It is both displayed as
  // an image and fetched when a customer downloads it.
  const connections = ["'self'", "https:"];
  if (supabaseOrigin.startsWith("http://")) connections.push(supabaseOrigin);
  if (isDevelopment) connections.push("ws:", "wss:");

  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    `connect-src ${connections.join(" ")}`,
    `frame-src ${turnstileOrigin}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const policy = contentSecurityPolicy(
    randomBytes(16).toString("base64"),
    new URL(supabaseUrl).origin,
  );
  function nextResponse() {
    const headers = new Headers(request.headers);
    // Next.js reads the request policy to add the nonce to its rendered scripts.
    headers.set("Content-Security-Policy", policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", policy);
    return response;
  }

  let response = nextResponse();
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  if (request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-")))
    await supabase.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
