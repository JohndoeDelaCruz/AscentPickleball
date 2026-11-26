"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteManagedAccount, setAccountRole } from "@/app/(workspace)/admin/access/actions";
import { accountRoleLabels, accountRolesHref, canManageAccount, type AccountRole, type ManagedAccount } from "@/lib/account-roles";
import { DeleteAccountDialog } from "./account-deletion";
import { Modal } from "./modal";
import { TablePagination } from "./table-pagination";
import { useAnimatedModal } from "./use-animated-modal";
import { WorkspacePageHeading } from "./workspace-page-heading";
import styles from "./account-roles.module.css";

const descriptions: Record<AccountRole, string> = {
  player: "Customer bookings and open play.",
  cashier: "Register, walk-ins, Paddle Stack, and register expenses.",
  manager: "Venue settings, inventory, finance, and front desk staff access.",
  owner: "Full admin access, including Manager and Owner roles.",
};

type AccountRolesProps = {
  rows: ManagedAccount[];
  count: number;
  page: number;
  pageSize: number;
  query: string;
  owner: boolean;
  userId: string;
};

function AccountSearch({ query }: { query: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submittedQuery = useRef(query);

  useEffect(() => () => clearTimeout(searchTimeout.current), []);
  useEffect(() => {
    if (query === submittedQuery.current) return;
    clearTimeout(searchTimeout.current);
    submittedQuery.current = query;
    if (input.current) input.current.value = query;
  }, [query]);

  function search(value: string) {
    clearTimeout(searchTimeout.current);
    const nextQuery = value.trim();
    searchTimeout.current = setTimeout(() => {
      if (nextQuery === submittedQuery.current) return;
      submittedQuery.current = nextQuery;
      router.replace(accountRolesHref(nextQuery), { scroll: false });
    }, 250);
  }

  return <div role="search" aria-label="Find accounts" className={styles.search}>
    <label className="field">
      <span className="sr-only">Search by name or email</span>
      <input ref={input} name="q" type="search" defaultValue={query} maxLength={254}
        placeholder="Search by name or email" onChange={(event) => search(event.currentTarget.value)} />
    </label>
  </div>;
}

export function AccountRoles(props: AccountRolesProps) {
  return <>
    <WorkspacePageHeading title="Access" />
    <section className="console-panel" aria-labelledby="account-roles">
      <div className={`panel-heading ${styles.toolbar}`}>
        <h2 id="account-roles">Accounts</h2>
        <AccountSearch query={props.query} />
      </div>
      <AccountRoleResults key={accountRolesHref(props.query, props.page)} {...props} />
    </section>
  </>;
}

function AccountRoleResults({ rows, count, page, pageSize, query, owner, userId }: AccountRolesProps) {
  const [dialog, setDialog, closing] = useAnimatedModal<{ account: ManagedAccount; action: "role" | "delete" }>();
  const [status, setStatus] = useState("");
  const account = dialog?.account;

  return <>
    {status && <p className={`success-message ${styles.status}`} role="status">{status}</p>}
    {rows.length > 0 && (
      <TablePagination count={count} page={page} pageSize={pageSize} label="Account pages" showSinglePage
        href={(nextPage) => accountRolesHref(query, nextPage)} />
    )}
    {rows.length ? (
      <div className="console-table-wrap" tabIndex={0} role="region" aria-labelledby="account-roles">
        <table className={`console-table ${styles.table}`}>
          <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const ownAccount = row.id === userId;
              const canManage = canManageAccount(row, owner, userId);
              const canEdit = canManage && (row.email_confirmed || row.role !== "player");
              const label = row.full_name ? `${row.full_name} (${row.email})` : row.email;
              return <tr key={row.id}>
                <td className={styles.email}>
                  <strong>{row.full_name || row.email}</strong>
                  {row.full_name && <small>{row.email}</small>}
                  {ownAccount && <small>Your account</small>}
                  {!row.email_confirmed && <small>Email confirmation pending</small>}
                </td>
                <td>{accountRoleLabels[row.role]}</td>
                <td>{canManage ? (
                  <div className={styles.rowActions}>
                    {canEdit && <button className="button button-outline button-small" type="button" aria-label={`Edit role for ${label}`}
                      onClick={() => { setStatus(""); setDialog({ account: row, action: "role" }); }}>Edit role</button>}
                    <button className={`button button-outline button-small ${styles.dangerButton}`} type="button"
                      aria-label={`Delete account for ${label}`}
                      onClick={() => { setStatus(""); setDialog({ account: row, action: "delete" }); }}>Delete</button>
                  </div>
                ) : <span className="small-print">{ownAccount ? "Your role" : "Owner only"}</span>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    ) : <p className="panel-empty-note">{query ? "No accounts match this search." : "No accounts found."}</p>}
    {account && dialog?.action === "role" && <RoleDialog key={account.id} account={account} owner={owner} closing={closing}
      onClose={() => setDialog(null)} onSaved={(role) => {
        setStatus(`${account.full_name || account.email} now has ${accountRoleLabels[role]} access.`);
        setDialog(null);
      }} />}
    {account && dialog?.action === "delete" && <DeleteAccountDialog key={account.id} email={account.email} closing={closing}
      onClose={() => setDialog(null)}
      deleteAccount={(confirmation) => deleteManagedAccount({ id: account.id, current: account.role, confirmation })}
      onDeleted={() => {
        setStatus("Account deleted.");
        setDialog(null);
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
      <div className={styles.email}>
        <strong>{account.full_name || account.email}</strong>
        {account.full_name && <p className="small-print">{account.email}</p>}
        <p className="small-print">Current role: {accountRoleLabels[account.role]}</p>
      </div>
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
