import "server-only";

import type { AccountRole } from "./account-roles";
import type { createClient } from "./supabase/server";

export type AccountDeletionResult = { ok: true; error?: never } | { ok?: never; error: string };

export async function deleteAccount(
  db: Awaited<ReturnType<typeof createClient>>,
  id: string,
  confirmation: string,
  expectedRole?: AccountRole,
): Promise<AccountDeletionResult> {
  const { error } = await db.rpc("delete_account", {
    p_user_id: id,
    p_confirmation: confirmation,
    p_expected_role: expectedRole ?? null,
  });
  if (!error) return { ok: true };
  if (error.message.startsWith("Access: ")) return { error: error.message.slice(8) };
  if (error.code === "PGRST202") return { error: "Account deletion is temporarily unavailable." };
  return { error: "The account couldn’t be deleted. Please try again or contact Ascent staff." };
}
