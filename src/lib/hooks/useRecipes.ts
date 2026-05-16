"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  RecipeRow,
  RecipeIngredientRow,
} from "@/lib/supabase/types";

export type Recipe = RecipeRow & { ingredients: RecipeIngredientRow[] };

export function useRecipes(householdId: string) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data: recipesData, error: recErr } = await supabase
      .from("recipes")
      .select("*")
      .eq("household_id", householdId)
      .order("name", { ascending: true });
    if (recErr) {
      setError(recErr.message);
      setLoading(false);
      return;
    }

    const ids = (recipesData ?? []).map((r) => r.id);
    let ingredientsData: RecipeIngredientRow[] = [];
    if (ids.length > 0) {
      const { data: ing, error: ingErr } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .in("recipe_id", ids)
        .order("position", { ascending: true });
      if (ingErr) {
        setError(ingErr.message);
        setLoading(false);
        return;
      }
      ingredientsData = ing ?? [];
    }

    const ingByRecipe = new Map<string, RecipeIngredientRow[]>();
    for (const i of ingredientsData) {
      if (!ingByRecipe.has(i.recipe_id)) ingByRecipe.set(i.recipe_id, []);
      ingByRecipe.get(i.recipe_id)!.push(i);
    }

    setRecipes(
      (recipesData ?? []).map((r) => ({
        ...r,
        ingredients: ingByRecipe.get(r.id) ?? [],
      }))
    );
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { recipes, loading, error, reload };
}

export type IngredientDraft = {
  id: string;
  name: string;
  quantity: string;
  category: string;
};

export async function saveRecipe(args: {
  id: string | null;
  household_id: string;
  created_by: string;
  name: string;
  notes: string | null;
  ingredients: IngredientDraft[];
}) {
  const supabase = createClient();
  const recipeId = args.id ?? crypto.randomUUID();

  // Upsert recipe row
  const { error: rErr } = await supabase
    .from("recipes")
    .upsert({
      id: recipeId,
      household_id: args.household_id,
      created_by: args.created_by,
      name: args.name,
      notes: args.notes,
    });
  if (rErr) throw rErr;

  // Replace ingredients : simpler than diffing for Phase 0
  const { error: dErr } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (dErr) throw dErr;

  if (args.ingredients.length > 0) {
    const rows = args.ingredients
      .filter((i) => i.name.trim())
      .map((i, idx) => ({
        recipe_id: recipeId,
        name: i.name.trim(),
        quantity: i.quantity.trim() || null,
        category: i.category.trim() || null,
        position: idx,
      }));
    if (rows.length > 0) {
      const { error: iErr } = await supabase
        .from("recipe_ingredients")
        .insert(rows);
      if (iErr) throw iErr;
    }
  }

  return recipeId;
}

export async function deleteRecipe(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export async function planRecipe(args: {
  household_id: string;
  date: string;
  slot: "lunch" | "dinner";
  recipe_id: string;
  add_to_shopping: boolean;
}) {
  const supabase = createClient();
  const { error } = await supabase.rpc("plan_recipe", {
    p_household_id: args.household_id,
    p_date: args.date,
    p_slot: args.slot,
    p_recipe_id: args.recipe_id,
    p_add_to_shopping: args.add_to_shopping,
  });
  if (error) throw error;
}
