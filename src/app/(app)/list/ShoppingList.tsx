"use client";

import { useMemo, useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
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

export default function ShoppingList() {
  const { userId, householdId } = useHousehold();
  const items = useShoppingList(householdId);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<string>("Frais");

  const { unchecked, checked, byCategory } = useMemo(() => {
    const u = items.filter((i) => i.checked_at === null);
    const c = items.filter((i) => i.checked_at !== null);
    const groups = new Map<string, ShoppingItem[]>();
    for (const it of u) {
      const k = it.category ?? "Autre";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(it);
    }
    return {
      unchecked: u,
      checked: c.sort((a, b) =>
        (b.checked_at ?? "").localeCompare(a.checked_at ?? "")
      ),
      byCategory: Array.from(groups.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      ),
    };
  }, [items]);

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

  return (
    <div className="space-y-4">
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
          La liste est vide — ajoute ton premier article ! 🛒
        </div>
      )}

      {byCategory.map(([cat, list]) => (
        <section
          key={cat}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
        >
          <h3 className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {cat}
          </h3>
          <ul className="divide-y divide-stone-100">
            {list.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                onCheck={() => checkItem(it.id, userId)}
                onDelete={() => deleteItem(it.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      {checked.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Dans le panier ({checked.length})
            </h3>
            <button
              onClick={() => clearChecked(householdId)}
              className="text-xs font-medium text-stone-600 hover:text-red-600"
            >
              Vider
            </button>
          </div>
          <ul className="divide-y divide-stone-100">
            {checked.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                checkedView
                onCheck={() => uncheckItem(it.id)}
                onDelete={() => deleteItem(it.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemRow({
  item,
  checkedView = false,
  onCheck,
  onDelete,
}: {
  item: ShoppingItem;
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
        <div
          className={`truncate text-base ${checkedView ? "text-stone-400 line-through" : "text-stone-900"}`}
        >
          {item.name}
        </div>
        {item.quantity && (
          <div className="text-xs text-stone-500">{item.quantity}</div>
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
