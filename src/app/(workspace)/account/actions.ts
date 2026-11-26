"use server";

import { createClient } from "@/lib/supabase/server";
import { changeAccountPassword } from "@/lib/password";
import { deleteAccount, type AccountDeletionResult } from "@/lib/account-deletion";
import { accountDeletionConfirmation } from "@/lib/account-roles";
import { readVerifiedUser } from "@/lib/session-access";

export async function changePassword(input: unknown) {
  const supabase = await createClient();
  return changeAccountPassword(supabase.auth, input);
}

export async function deleteOwnAccount(confirmation: unknown): Promise<AccountDeletionResult> {
  if (confirmation !== accountDeletionConfirmation) return { error: "Type DELETE to confirm account deletion." };

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await readVerifiedUser(supabase.auth);
    if (error || !user) return { error: "Log in again before deleting your account." };
    const result = await deleteAccount(supabase, user.id, confirmation);
    // After deletion Auth may return an error for the now-revoked session.
    if (result.ok) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return result;
  } catch {
    return { error: "We couldn’t confirm account deletion. Sign in again to check your account." };
  }
}
