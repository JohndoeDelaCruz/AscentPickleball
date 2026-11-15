"use client";

import { formatDate } from "@/lib/booking";
import { membershipReviewHref, membershipReviewPageSize, type ActiveMembershipRow } from "@/lib/membership-applications";
import { TablePagination } from "./table-pagination";

export function ActiveMembersTable({ rows, count, page }: { rows: ActiveMembershipRow[]; count: number; page: number }) {
  return <section className="console-panel" aria-labelledby="active-members-heading">
    <div className="panel-heading"><h2 id="active-members-heading">Active members</h2></div>
    {rows.length === 0 ? <p className="panel-empty-note">There are no active members yet.</p> : <>
      <TablePagination count={count} page={page} pageSize={membershipReviewPageSize} label="Active member pages"
        href={(next) => membershipReviewHref("active", next)} />
      <div className="console-table-wrap" role="region" aria-labelledby="active-members-heading" tabIndex={0}>
        <table className="console-table">
          <thead><tr><th scope="col">Member</th><th scope="col">Plan</th><th scope="col">Starts on</th><th scope="col">Expires on</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td><strong>{row.full_name || row.email || "Member"}</strong>{row.full_name && row.email && <small>{row.email}</small>}</td>
            <td>{row.plan_name}</td>
            <td>{formatDate(row.starts_on)}</td>
            <td>{formatDate(row.expires_on)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
