import Dexie, { type EntityTable } from "dexie";
import type { ShoppingItemRow, MealPlanRow } from "@/lib/supabase/types";

export type PendingMutation = {
  id?: number;
  op:
    | "insert_item"
    | "update_item"
    | "delete_item"
    | "check_item"
    | "uncheck_item"
    | "clear_checked";
  payload: Record<string, unknown>;
  queued_at: string;
};

export class CoursesDB extends Dexie {
  shopping_items!: EntityTable<ShoppingItemRow, "id">;
  meal_plans!: EntityTable<MealPlanRow, "id">;
  pending_mutations!: EntityTable<PendingMutation, "id">;

  constructor() {
    super("mes-ptites-courses");
    this.version(1).stores({
      shopping_items:
        "id, household_id, cleared_at, checked_at, category, [household_id+cleared_at]",
      meal_plans: "id, household_id, date, [household_id+date]",
      pending_mutations: "++id, op, queued_at",
    });
  }
}

let _db: CoursesDB | null = null;

export function db() {
  if (typeof window === "undefined") {
    throw new Error("Dexie DB can only be used in the browser.");
  }
  if (!_db) _db = new CoursesDB();
  return _db;
}
