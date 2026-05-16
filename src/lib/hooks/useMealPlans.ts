"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/dexie/db";
import { pullMealPlans } from "@/lib/dexie/sync";
import { createClient } from "@/lib/supabase/client";
import type { MealPlanRow } from "@/lib/supabase/types";

export function useMealPlans(householdId: string, isoDates: string[]) {
  useEffect(() => {
    let cancelled = false;
    pullMealPlans(householdId).catch(() => {});

    const supabase = createClient();
    const channel = supabase
      .channel(`meal_plans:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "courses",
          table: "meal_plans",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          if (!cancelled) pullMealPlans(householdId).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const plans =
    useLiveQuery(
      () =>
        db()
          .meal_plans.where("household_id")
          .equals(householdId)
          .and((m) => isoDates.includes(m.date))
          .toArray(),
      [householdId, isoDates.join(",")]
    ) ?? [];

  return plans as MealPlanRow[];
}

export async function upsertMealPlan(plan: {
  id: string;
  household_id: string;
  date: string;
  slot: "lunch" | "dinner";
  title: string;
  notes: string | null;
  created_by: string;
  recipe_id?: string | null;
}) {
  const now = new Date().toISOString();
  const row = {
    ...plan,
    recipe_id: plan.recipe_id ?? null,
    created_at: now,
    updated_at: now,
  };
  await db().meal_plans.put(row);
  const supabase = createClient();
  const { error } = await supabase
    .from("meal_plans")
    .upsert(row, { onConflict: "household_id,date,slot" });
  if (error) throw error;
}

export async function deleteMealPlan(id: string) {
  await db().meal_plans.delete(id);
  const supabase = createClient();
  const { error } = await supabase.from("meal_plans").delete().eq("id", id);
  if (error) throw error;
}
