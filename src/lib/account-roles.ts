import type { WorkspaceRole } from "./session-access";

export const accountRolesPath = "/admin/access";
export const accountRolesPageSize = 25;
export const accountRoleLabels = {
  player: "Player",
  cashier: "Cashier",
  manager: "Manager",
  owner: "Owner",
} satisfies Record<WorkspaceRole | "player", string>;

export type AccountRole = keyof typeof accountRoleLabels;
export type ManagedAccount = {
  id: string;
  email: string;
  email_confirmed: boolean;
  role: AccountRole;
};

export function accountRolesHref(query: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${accountRolesPath}?${params}` : accountRolesPath;
}
