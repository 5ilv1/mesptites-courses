"use client";

import { db, type PendingMutation } from "./db";
import { createClient } from "@/lib/supabase/client";
import type {
  ShoppingItemRow,
  MealPlanRow,
} from "@/lib/supabase/types";

export async function pullShoppingItems(householdId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("household_id", householdId);
  if (error) throw error;

  const rows = (data ?? []) as ShoppingItemRow[];
  const serverIds = new Set(rows.map((r) => r.id));

  // Supprime les items locaux qui n'existent plus côté serveur
  // (sinon les DELETE distants ne se répercutent jamais dans Dexie).
  const localIds = await db()
    .shopping_items.where("household_id")
    .equals(householdId)
    .primaryKeys();
  const toDelete = localIds.filter((id) => !serverIds.has(id));
  if (toDelete.length > 0) {
    await db().shopping_items.bulkDelete(toDelete);
  }

  await db().shopping_items.bulkPut(rows);
}

export async function pullMealPlans(householdId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("household_id", householdId);
  if (error) throw error;

  const rows = (data ?? []) as MealPlanRow[];
  const serverIds = new Set(rows.map((r) => r.id));

  const localIds = await db()
    .meal_plans.where("household_id")
    .equals(householdId)
    .primaryKeys();
  const toDelete = localIds.filter((id) => !serverIds.has(id));
  if (toDelete.length > 0) {
    await db().meal_plans.bulkDelete(toDelete);
  }

  await db().meal_plans.bulkPut(rows);
}

export async function enqueue(mut: Omit<PendingMutation, "id" | "queued_at">) {
  await db().pending_mutations.add({
    ...mut,
    queued_at: new Date().toISOString(),
  });
}

export async function drainQueue() {
  if (!navigator.onLine) return;
  const supabase = createClient();
  const pending = await db()
    .pending_mutations.orderBy("queued_at")
    .toArray();

  for (const mut of pending) {
    try {
      await applyMutation(supabase, mut);
      await db().pending_mutations.delete(mut.id!);
    } catch {
      // Stop draining at first failure — we'll retry on next online event
      return;
    }
  }
}

async function applyMutation(
  supabase: ReturnType<typeof createClient>,
  mut: PendingMutation
) {
  const p = mut.payload as Record<string, unknown>;
  switch (mut.op) {
    case "insert_item":
      await supabase.from("shopping_items").insert(p as never);
      return;
    case "update_item":
      await supabase
        .from("shopping_items")
        .update(p.changes as never)
        .eq("id", p.id as string);
      return;
    case "delete_item":
      await supabase.from("shopping_items").delete().eq("id", p.id as string);
      return;
    case "check_item":
      await supabase
        .from("shopping_items")
        .update({
          checked_at: p.checked_at,
          checked_by: p.checked_by,
        } as never)
        .eq("id", p.id as string);
      return;
    case "uncheck_item":
      await supabase
        .from("shopping_items")
        .update({ checked_at: null, checked_by: null } as never)
        .eq("id", p.id as string);
      return;
    case "clear_checked":
      await supabase
        .from("shopping_items")
        .update({ cleared_at: p.cleared_at } as never)
        .eq("household_id", p.household_id as string)
        .not("checked_at", "is", null)
        .is("cleared_at", null);
      return;
  }
}
