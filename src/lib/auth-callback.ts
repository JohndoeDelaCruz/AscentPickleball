import { authRedirect, safeRedirect } from "./redirect";
import { readStaffMembership } from "./session-access";

export type AuthCallbackClient = {
  auth: {
    exchangeCodeForSession: (
      code: string,
      options?: { flowId?: string },
    ) => PromiseLike<{ error: unknown }>;
  };
  rpc: (name: "is_club_staff" | "is_staff") => PromiseLike<{ data: unknown; error: unknown }>;
};

type SignupConfirmationClient = Pick<AuthCallbackClient, "rpc"> & {
  auth: {
    verifyOtp: (input: { type: "email"; token_hash: string }) => PromiseLike<{
      data: { session: unknown };
      error: unknown;
    }>;
  };
};

async function signedInDestination(next: string | null, client: Pick<AuthCallbackClient, "rpc">) {
  try {
    return authRedirect(next, await readStaffMembership(client));
  } catch {
    return "/login?error=access";
  }
}

export async function authCallbackDestination(
  params: URLSearchParams,
  client: AuthCallbackClient,
) {
  const code = params.get("code");
  if (!code) return "/login?error=callback";
  const flowId = params.get("sb_flow_id");
  try {
    const { error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) return "/login?error=callback";
  } catch {
    return "/login?error=callback";
  }

  return signedInDestination(params.get("next"), client);
}

export function signupConfirmationReturnPath(redirectTo: unknown) {
  if (typeof redirectTo !== "string") return "";
  try {
    // Read the existing callback's return path without following the URL supplied by the email.
    const url = new URL(redirectTo);
    return url.pathname === "/auth/callback"
      ? safeRedirect(url.searchParams.get("next"), "")
      : "";
  } catch {
    return "";
  }
}

export async function signupConfirmationDestination(
  token: unknown,
  next: unknown,
  client: SignupConfirmationClient,
) {
  const returnPath = safeRedirect(next, "");
  const params = new URLSearchParams({ error: "confirmation" });
  if (returnPath) params.set("next", returnPath);
  const failed = `/login?${params}`;
  if (typeof token !== "string" || !token.trim()) return failed;

  try {
    const { data, error } = await client.auth.verifyOtp({ type: "email", token_hash: token });
    if (error || !data.session) return failed;
  } catch {
    return failed;
  }
  return signedInDestination(returnPath, client);
}
