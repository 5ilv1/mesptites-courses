"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useHousehold } from "@/lib/HouseholdContext";
import { db } from "@/lib/dexie/db";
import { pullMealPlans } from "@/lib/dexie/sync";
import {
  useShoppingList,
  addItem,
  checkItem,
  uncheckItem,
  deleteItem,
  clearChecked,
  type ShoppingItem,
} from "@/lib/hooks/useShoppingList";

const CATEGORIES = [
  "Frais",
  "Surgelé",
  "Fruits & légumes",
  "Épicerie",
  "Boissons",
  "Hygiène",
  "Maison",
  "Autre",
] as const;

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type GroupedItem = {
  key: string;
  name: string;
  category: string;
  count: number;
  quantities: string[];
  sources: ShoppingItem[];
};

function groupItems(items: ShoppingItem[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const it of items) {
    const cat = it.category ?? "Autre";
    const key = `${cat}::${it.name.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: it.name,
        category: cat,
        count: 0,
        quantities: [],
        sources: [],
      });
    }
    const g = map.get(key)!;
    g.count += 1;
    g.sources.push(it);
    if (it.quantity && it.quantity.trim()) g.quantities.push(it.quantity.trim());
  }
  return Array.from(map.values());
}

export default function ShoppingList() {
  const { userId, householdId } = useHousehold();
  const allItems = useShoppingList(householdId);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<string>("Frais");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const monday = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const sunday = useMemo(() => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + 6);
    return d;
  }, [monday]);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return isoDate(d);
      }),
    [monday]
  );

  // Charge les meal_plans pour pouvoir filtrer les items par date
  useEffect(() => {
    pullMealPlans(householdId).catch(() => {});
  }, [householdId]);

  const weekMealPlanIds = useLiveQuery(
    () =>
      db()
        .meal_plans.where("household_id")
        .equals(householdId)
        .and((m) => weekDates.includes(m.date))
        .primaryKeys(),
    [householdId, weekDates.join(",")]
  );

  const filtered = useMemo(() => {
    if (showAll) return allItems;
    // weekMealPlanIds peut être undefined pendant le chargement Dexie : on
    // garde les items manuels visibles le temps que ça arrive.
    const idSet = new Set(weekMealPlanIds ?? []);
    return allItems.filter(
      (it) => it.meal_plan_id === null || idSet.has(it.meal_plan_id)
    );
  }, [allItems, weekMealPlanIds, showAll]);

  const { unchecked, checked, byCategory } = useMemo(() => {
    const u = filtered.filter((i) => i.checked_at === null);
    const c = filtered.filter((i) => i.checked_at !== null);
    const groupsByCat = new Map<string, GroupedItem[]>();
    for (const g of groupItems(u)) {
      if (!groupsByCat.has(g.category)) groupsByCat.set(g.category, []);
      groupsByCat.get(g.category)!.push(g);
    }
    return {
      unchecked: u,
      checked: groupItems(c).sort((a, b) => a.name.localeCompare(b.name)),
      byCategory: Array.from(groupsByCat.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      ),
    };
  }, [filtered]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await addItem({
      id: crypto.randomUUID(),
      household_id: householdId,
      created_by: userId,
      name: trimmed,
      quantity: quantity.trim() || null,
      category,
    });
    setName("");
    setQuantity("");
  }

  async function bulkCheck(sources: ShoppingItem[]) {
    await Promise.all(sources.map((s) => checkItem(s.id, userId)));
  }
  async function bulkUncheck(sources: ShoppingItem[]) {
    await Promise.all(sources.map((s) => uncheckItem(s.id)));
  }
  async function bulkDelete(sources: ShoppingItem[]) {
    await Promise.all(sources.map((s) => deleteItem(s.id)));
  }

  async function handleClear() {
    // Ne vide que ce qui est visible (la période courante)
    const visibleCheckedIds = filtered
      .filter((i) => i.checked_at !== null)
      .map((i) => i.id);
    if (visibleCheckedIds.length === 0) return;
    if (showAll) {
      await clearChecked(householdId);
    } else {
      // Marker comme cleared chaque item visible coché
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase
        .from("shopping_items")
        .update({ cleared_at: new Date().toISOString() })
        .in("id", visibleCheckedIds);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de période */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setShowAll(false);
            setWeekOffset(weekOffset - 1);
          }}
          disabled={showAll}
          className="rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-100 disabled:opacity-40"
        >
          ←
        </button>
        <button
          onClick={() => setShowAll((v) => !v)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium shadow-sm ${
            showAll
              ? "bg-green-600 text-white"
              : "bg-white text-stone-700 hover:bg-stone-100"
          }`}
        >
          {showAll
            ? "🌐 Toutes périodes"
            : `${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
        </button>
        <button
          onClick={() => {
            setShowAll(false);
            setWeekOffset(weekOffset + 1);
          }}
          disabled={showAll}
          className="rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-100 disabled:opacity-40"
        >
          →
        </button>
      </div>

      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ajouter un article…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-green-600"
          />
          <input
            type="text"
            placeholder="Qté"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20 rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-green-600"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </form>

      {unchecked.length === 0 && checked.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          {showAll
            ? "La liste est vide — ajoute ton premier article ! 🛒"
            : "Rien à acheter sur cette semaine. Pose des recettes sur le planning, ou ajoute des articles ci-dessus."}
        </div>
      )}

      {byCategory.map(([cat, groups]) => (
        <section
          key={cat}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
        >
          <h3 className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {cat}
          </h3>
          <ul className="divide-y divide-stone-100">
            {groups.map((g) => (
              <GroupRow
                key={g.key}
                group={g}
                onCheck={() => bulkCheck(g.sources)}
                onDelete={() => bulkDelete(g.sources)}
              />
            ))}
          </ul>
        </section>
      ))}

      {checked.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Dans le panier ({checked.reduce((s, g) => s + g.count, 0)})
            </h3>
            <button
              onClick={handleClear}
              className="text-xs font-medium text-stone-600 hover:text-red-600"
            >
              Vider
            </button>
          </div>
          <ul className="divide-y divide-stone-100">
            {checked.map((g) => (
              <GroupRow
                key={g.key}
                group={g}
                checkedView
                onCheck={() => bulkUncheck(g.sources)}
                onDelete={() => bulkDelete(g.sources)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function GroupRow({
  group,
  checkedView = false,
  onCheck,
  onDelete,
}: {
  group: GroupedItem;
  checkedView?: boolean;
  onCheck: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <button
        onClick={onCheck}
        aria-label={checkedView ? "Décocher" : "Cocher"}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
          checkedView
            ? "border-green-600 bg-green-600 text-white"
            : "border-stone-300 bg-white"
        }`}
      >
        {checkedView ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-base ${checkedView ? "text-stone-400 line-through" : "text-stone-900"}`}
          >
            {group.name}
          </span>
          {group.count > 1 && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                checkedView
                  ? "bg-stone-100 text-stone-400"
                  : "bg-green-100 text-green-800"
              }`}
            >
              ×{group.count}
            </span>
          )}
        </div>
        {group.quantities.length > 0 && (
          <div className="text-xs text-stone-500">
            {group.quantities.join(" · ")}
          </div>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label="Supprimer"
        className="rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-red-600"
      >
        ✕
      </button>
    </li>
  );
}
