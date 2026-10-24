"use client";

import { useId, useState } from "react";
import { formatHour } from "@/lib/booking";
import { parseSettingHour, parseSettingNumber } from "@/lib/settings-input";

export function TypedSettingField({
  label,
  value,
  kind = "money",
  min,
  max,
  optional = false,
  hint,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  kind?: "money" | "integer" | "hour";
  min: number;
  max: number;
  optional?: boolean;
  hint?: string;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(() =>
    value === null ? "" : kind === "hour" ? formatHour(value) : String(value),
  );
  const hintId = useId();
  function parse(text: string) {
    return kind === "hour"
      ? parseSettingHour(text, { min, max, optional })
      : parseSettingNumber(text, {
          min,
          max,
          optional,
          integer: kind === "integer",
        });
  }
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode={
          kind === "hour" ? "text" : kind === "integer" ? "numeric" : "decimal"
        }
        value={draft}
        required={!optional}
        maxLength={kind === "hour" ? 12 : 14}
        placeholder={
          placeholder ?? (kind === "hour" ? "e.g. 4:00 PM or 16:00" : undefined)
        }
        aria-describedby={hint ? hintId : undefined}
        autoComplete="off"
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const result = parse(text);
          event.currentTarget.setCustomValidity(result.error ?? "");
          if (result.error === undefined) onChange(result.value);
        }}
        onBlur={(event) =>
          event.currentTarget.setCustomValidity(parse(draft).error ?? "")
        }
      />
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
