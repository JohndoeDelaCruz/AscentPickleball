"use client";

import { money } from "@/lib/booking";

export function EquipmentRental({
  price,
  checked,
  onChange,
  disabled = false,
}: {
  price: number;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`equipment-rental-option ${checked ? "is-selected" : ""}`}
    >
      <input
        type="checkbox"
        name="equipment_rental"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <strong>
          Rent equipment <span>{money(price)}</span>
        </strong>
        <small>1 paddle + 2 balls · one set per booking</small>
        <small>Charged once, added to your booking total.</small>
      </span>
    </label>
  );
}
