"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { setAccountRole } from "@/app/(workspace)/admin/access/actions";
import { accountRoleLabels, accountRolesHref, accountRolesPageSize, type AccountRole, type ManagedAccount } from "@/lib/account-roles";
import { Modal } from "./modal";
import { TablePagination } from "./table-pagination";
import { useAnimatedModal } from "./use-animated-modal";
import { WorkspacePageHeading } from "./workspace-page-heading";
import styles from "./account-roles.module.css";

const descriptions: Record<AccountRole, string> = {
  player: "Customer bookings and open play.",
  cashier: "Register, walk-ins, Paddle Stack, and register expenses.",
  manager: "Venue settings, inventory, finance, and cashier access.",
  owner: "Full admin access, including Manager and Owner roles.",
};

export function AccountRoles({ rows, count, page, query, owner, userId }: {
  rows: ManagedAccount[];
  count: number;
  page: number;
  query: string;
  owner: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [account, setAccount, closing] = useAnimatedModal<ManagedAccount>();
  const [status, setStatus] = useState("");

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    router.push(accountRolesHref(typeof value === "string" ? value.trim() : ""));
  }

  return <>
    <WorkspacePageHeading title="Access" />
    <section className="console-panel" aria-labelledby="account-roles">
      <div className={`panel-heading ${styles.toolbar}`}>
        <h2 id="account-roles">Account roles</h2>
        <form onSubmit={search} role="search" aria-label="Find accounts" className={styles.search}>
          <label className="field">
            <span className="sr-only">Search by email</span>
            <input name="q" type="search" defaultValue={query} maxLength={254} placeholder="Search by email" />
          </label>
          <button className="button button-outline button-small"><Search size={16} aria-hidden="true" /> Search</button>
        </form>
      </div>
      {status && <p className={`success-message ${styles.status}`} role="status">{status}</p>}
      {rows.length ? (
        <div className="console-table-wrap" tabIndex={0} role="region" aria-labelledby="account-roles">
          <table className={`console-table ${styles.table}`}>
            <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const ownAccount = row.id === userId;
                const canEdit = !ownAccount && (owner || row.role === "player" || row.role === "cashier")
                  && (row.email_confirmed || row.role !== "player");
                return <tr key={row.id}>
                  <td className={styles.email}>
                    <strong>{row.email}</strong>
                    {ownAccount && <small>Your account</small>}
                    {!row.email_confirmed && <small>Email confirmation pending</small>}
                  </td>
                  <td>{accountRoleLabels[row.role]}</td>
                  <td>{canEdit ? (
                    <button className="button button-outline button-small" type="button" aria-label={`Edit role for ${row.email}`}
                      onClick={() => { setStatus(""); setAccount(row); }}>Edit role</button>
                  ) : <span className="small-print">
                    {ownAccount ? "Your role" : (row.role === "owner" || row.role === "manager") ? "Owner only" : "Awaiting confirmation"}
                  </span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="panel-empty-note">{query ? "No accounts match this email search." : "No accounts found."}</p>}
      <TablePagination count={count} page={page} pageSize={accountRolesPageSize} label="Account pages" href={(nextPage) => accountRolesHref(query, nextPage)} />
    </section>
    {account && <RoleDialog key={account.id} account={account} owner={owner} closing={closing}
      onClose={() => setAccount(null)} onSaved={(role) => {
        setStatus(`${account.email} now has ${accountRoleLabels[role]} access.`);
        setAccount(null);
      }} />}
  </>;
}

function RoleDialog({ account, owner, closing, onClose, onSaved }: {
  account: ManagedAccount;
  owner: boolean;
  closing: boolean;
  onClose: () => void;
  onSaved: (role: AccountRole) => void;
}) {
  const [role, setRole] = useState(account.role);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const options: AccountRole[] = account.email_confirmed
    ? owner ? ["player", "cashier", "manager", "owner"] : ["player", "cashier"]
    : ["player", account.role];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || closing || role === account.role) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await setAccountRole({ id: account.id, current: account.role, next: role });
        if (result.error) setError(result.error);
        else onSaved(role);
      } catch {
        setError("Couldn’t confirm the role change. Refresh Access to check the saved role.");
      }
    });
  }

  return <Modal title="Edit account role" closing={closing} onClose={() => !pending && onClose()}>
    <form className="form-stack" onSubmit={save}>
      <div className={styles.email}><strong>{account.email}</strong><p className="small-print">Current role: {accountRoleLabels[account.role]}</p></div>
      <label className="field">
        <span>New role</span>
        <select value={role} disabled={pending} onChange={(event) => {
          const value = options.find((item) => item === event.target.value);
          if (value) setRole(value);
          setError("");
        }}>
          {options.map((option) => <option key={option} value={option}>{accountRoleLabels[option]}</option>)}
        </select>
        <small>{descriptions[role]}</small>
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className="button button-outline" type="button" onClick={onClose} disabled={pending || closing}>Cancel</button>
        <button className="button button-dark" disabled={pending || closing || role === account.role}>{pending ? "Saving…" : "Save role"}</button>
      </div>
    </form>
  </Modal>;
}
