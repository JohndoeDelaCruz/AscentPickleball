import type { Shift } from "./pos";

type Cashier = { id: string; label: string };

export type RegisterDay = {
  assignment: (Cashier & { eligible: boolean }) | null;
  cashiers: Cashier[];
  operators: string[];
  active: { label: string; opened_at: string; own_shift: Shift | null } | null;
};
