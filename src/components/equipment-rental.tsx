"use client";

import { equipmentPackageLabel, money } from "@/lib/booking";

export function EquipmentRental({
  price,
  ballCount,
  checked,
  onChange,
  disabled = false,
}: {
  price: number;
  ballCount: number;
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
        <small>{equipmentPackageLabel(ballCount)} · one set per booking</small>
        <small>Charged once, added to your booking total.</small>
      </span>
    </label>
  );
}
