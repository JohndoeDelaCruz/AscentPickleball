"use client";

import { useState, useTransition } from "react";
import { findMembershipCustomers, type MembershipCustomer } from "@/app/(workspace)/staff/memberships/actions";

export function WalkInCustomerLookup({ customer, onChange }: {
  customer: MembershipCustomer | null;
  onChange: (customer: MembershipCustomer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MembershipCustomer[] | null>(null);
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();

  function search() {
    if (query.trim().length < 2 || searching) return;
    setMatches(null);
    setError("");
    startSearch(async () => {
      const result = await findMembershipCustomers(query);
      if ("error" in result) setError(result.error);
      else setMatches(result.customers);
    });
  }

  if (customer) return <div className="court-time-summary">
    <strong>Linked account</strong>
    <p>{[customer.full_name, customer.email].filter(Boolean).join(" · ")}</p>
    <button type="button" className="button button-small button-outline" onClick={() => onChange(null)}>Remove account</button>
  </div>;

  return <details>
    <summary>Link customer account (optional)</summary>
    <div className="form-stack">
      <label className="field"><span>Customer name or full email address</span>
        <input type="search" value={query} maxLength={254} disabled={searching} onChange={(event) => {
          setQuery(event.target.value);
          setMatches(null);
          setError("");
        }} onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          search();
        }} />
      </label>
      <div><button type="button" className="button button-outline button-small" onClick={search} disabled={searching || query.trim().length < 2}>
        {searching ? "Searching…" : "Find customer"}
      </button></div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {matches?.length === 0 && <p role="status">No confirmed customer accounts found.</p>}
      {matches && matches.length > 0 && <ul className="membership-customer-results" aria-label="Matching customer accounts">
        {matches.map((match) => <li key={match.id}>
          <button type="button" className="console-button membership-customer-result" onClick={() => onChange(match)}>
            {match.full_name && <strong>{match.full_name}</strong>}
            <span>{match.email}</span>
          </button>
        </li>)}
      </ul>}
    </div>
  </details>;
}
