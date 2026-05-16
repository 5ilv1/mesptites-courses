"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/dexie/db";
import { drainQueue, enqueue, pullShoppingItems } from "@/lib/dexie/sync";
import { createClient } from "@/lib/supabase/client";

export type ShoppingItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  meal_plan_id: string | null;
  checked_at: string | null;
  checked_by: string | null;
  cleared_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useShoppingList(householdId: string) {
  // Initial sync + realtime
  useEffect(() => {
    let cancelled = false;
    pullShoppingItems(householdId).catch(() => {});

    const supabase = createClient();
    const channel = supabase
      .channel(`shopping_items:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "courses",
          table: "shopping_items",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          if (!cancelled) pullShoppingItems(householdId).catch(() => {});
        }
      )
      .subscribe();

    const handleOnline = () => drainQueue().catch(() => {});
    window.addEventListener("online", handleOnline);
    drainQueue().catch(() => {});

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
    };
  }, [householdId]);

  const items =
    useLiveQuery(
      () =>
        db()
          .shopping_items.where("household_id")
          .equals(householdId)
          .filter((it) => it.cleared_at === null)
          .toArray(),
      [householdId]
    ) ?? [];

  return items as ShoppingItem[];
}

export async function addItem(item: {
  id: string;
  household_id: string;
  created_by: string;
  name: string;
  quantity: string | null;
  category: string | null;
}) {
  const now = new Date().toISOString();
  const row = {
    ...item,
    meal_plan_id: null,
    checked_at: null,
    checked_by: null,
    cleared_at: null,
    created_at: now,
    updated_at: now,
  };
  await db().shopping_items.put(row);
  if (navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").insert(row);
    if (error) await enqueue({ op: "insert_item", payload: row });
  } else {
    await enqueue({ op: "insert_item", payload: row });
  }
}

export async function checkItem(id: string, userId: string) {
  const now = new Date().toISOString();
  await db().shopping_items.update(id, {
    checked_at: now,
    checked_by: userId,
    updated_at: now,
  });
  if (navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .update({ checked_at: now, checked_by: userId })
      .eq("id", id);
    if (error)
      await enqueue({
        op: "check_item",
        payload: { id, checked_at: now, checked_by: userId },
      });
  } else {
    await enqueue({
      op: "check_item",
      payload: { id, checked_at: now, checked_by: userId },
    });
  }
}

export async function uncheckItem(id: string) {
  const now = new Date().toISOString();
  await db().shopping_items.update(id, {
    checked_at: null,
    checked_by: null,
    updated_at: now,
  });
  if (navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .update({ checked_at: null, checked_by: null })
      .eq("id", id);
    if (error) await enqueue({ op: "uncheck_item", payload: { id } });
  } else {
    await enqueue({ op: "uncheck_item", payload: { id } });
  }
}

export async function deleteItem(id: string) {
  await db().shopping_items.delete(id);
  if (navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").delete().eq("id", id);
    if (error) await enqueue({ op: "delete_item", payload: { id } });
  } else {
    await enqueue({ op: "delete_item", payload: { id } });
  }
}

export async function clearChecked(householdId: string) {
  const now = new Date().toISOString();
  const checkedIds = await db()
    .shopping_items.where("household_id")
    .equals(householdId)
    .filter((it) => it.checked_at !== null && it.cleared_at === null)
    .primaryKeys();
  await db().shopping_items.bulkUpdate(
    checkedIds.map((id) => ({ key: id, changes: { cleared_at: now } }))
  );
  if (navigator.onLine) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .update({ cleared_at: now })
      .eq("household_id", householdId)
      .not("checked_at", "is", null)
      .is("cleared_at", null);
    if (error)
      await enqueue({
        op: "clear_checked",
        payload: { household_id: householdId, cleared_at: now },
      });
  } else {
    await enqueue({
      op: "clear_checked",
      payload: { household_id: householdId, cleared_at: now },
    });
  }
}
