import { z } from "zod";
import { createClient } from "./supabase/server";

const counterProduct = z.object({
  name: z.string(),
  category: z.string(),
  price_cents: z.int().positive(),
  photo_version: z.uuid().nullable(),
});

export type CounterProduct = z.infer<typeof counterProduct>;

export async function getCounterProducts() {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("list_counter_products");
    return error ? [] : z.array(counterProduct).safeParse(data).data ?? [];
  } catch {
    return [];
  }
}
