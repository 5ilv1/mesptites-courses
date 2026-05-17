"use client";

import { useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
import {
  useRecipes,
  saveRecipe,
  deleteRecipe,
  type Recipe,
  type IngredientDraft,
} from "@/lib/hooks/useRecipes";

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

type DraftState = {
  id: string | null;
  name: string;
  notes: string;
  ingredients: IngredientDraft[];
};

function emptyDraft(): DraftState {
  return {
    id: null,
    name: "",
    notes: "",
    ingredients: [
      { id: crypto.randomUUID(), name: "", quantity: "", category: "Frais" },
    ],
  };
}

export default function RecipesView() {
  const { userId, householdId } = useHousehold();
  const { recipes, loading, error, reload } = useRecipes(householdId);
  const [draft, setDraft] = useState<DraftState | null>(null);

  function startEdit(r: Recipe) {
    setDraft({
      id: r.id,
      name: r.name,
      notes: r.notes ?? "",
      ingredients:
        r.ingredients.length > 0
          ? r.ingredients.map((i) => ({
              id: i.id,
              name: i.name,
              quantity: i.quantity ?? "",
              category: i.category ?? "Frais",
            }))
          : [
              {
                id: crypto.randomUUID(),
                name: "",
                quantity: "",
                category: "Frais",
              },
            ],
    });
  }

  async function handleSave() {
    if (!draft) return;
    const cleaned = draft.ingredients.filter((i) => i.name.trim() !== "");
    await saveRecipe({
      id: draft.id,
      household_id: householdId,
      created_by: userId,
      name: draft.name.trim() || "Sans nom",
      notes: draft.notes.trim() || null,
      ingredients: cleaned,
    });
    setDraft(null);
    await reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette recette ?")) return;
    await deleteRecipe(id);
    setDraft(null);
    await reload();
  }

  if (draft) {
    return <Editor draft={draft} setDraft={setDraft} onSave={handleSave} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recettes</h2>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="rounded-xl bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Nouvelle
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-stone-500">Chargement…</div>
      )}

      {!loading && recipes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          Aucune recette pour l&apos;instant. Crée-en une et tu pourras la
          planifier en un clic, avec ses ingrédients ajoutés à la liste de
          courses automatiquement.
        </div>
      )}

      <ul className="space-y-2">
        {recipes.map((r) => (
          <li
            key={r.id}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
          >
            <button
              onClick={() => startEdit(r)}
              className="block w-full px-4 py-3 text-left transition hover:bg-stone-50"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-stone-500">
                  {r.ingredients.length} ingrédient
                  {r.ingredients.length > 1 ? "s" : ""}
                </div>
              </div>
              {r.notes && (
                <div className="mt-1 truncate text-sm text-stone-500">
                  {r.notes}
                </div>
              )}
              {r.ingredients.length > 0 && (
                <div className="mt-1 truncate text-xs text-stone-400">
                  {r.ingredients.map((i) => i.name).join(" · ")}
                </div>
              )}
            </button>
            <div className="flex justify-end gap-1 border-t border-stone-100 bg-stone-50 px-2 py-1">
              <button
                onClick={() => handleDelete(r.id)}
                className="rounded px-2 py-1 text-xs text-stone-500 hover:text-red-600"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  onSave,
}: {
  draft: DraftState;
  setDraft: (d: DraftState | null) => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  function updateIngredient(idx: number, patch: Partial<IngredientDraft>) {
    setDraft({
      ...draft,
      ingredients: draft.ingredients.map((i, k) =>
        k === idx ? { ...i, ...patch } : i
      ),
    });
  }

  function addIngredient() {
    setDraft({
      ...draft,
      ingredients: [
        ...draft.ingredients,
        { id: crypto.randomUUID(), name: "", quantity: "", category: "Frais" },
      ],
    });
  }

  function removeIngredient(idx: number) {
    setDraft({
      ...draft,
      ingredients: draft.ingredients.filter((_, k) => k !== idx),
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {draft.id ? "Modifier la recette" : "Nouvelle recette"}
        </h2>
        <button
          onClick={() => setDraft(null)}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Annuler
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Nom de la recette"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-green-600"
        />
        <textarea
          placeholder="Notes (optionnel) — étapes rapides, durée…"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <h3 className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Ingrédients
        </h3>
        <ul className="divide-y divide-stone-100">
          {draft.ingredients.map((ing, idx) => (
            <li key={ing.id} className="px-3 py-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ingrédient"
                  value={ing.name}
                  onChange={(e) =>
                    updateIngredient(idx, { name: e.target.value })
                  }
                  className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-green-600"
                />
                <input
                  type="text"
                  placeholder="Qté"
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(idx, { quantity: e.target.value })
                  }
                  className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-green-600"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="rounded-lg px-2 text-stone-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              <select
                value={ing.category}
                onChange={(e) =>
                  updateIngredient(idx, { category: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs outline-none focus:border-green-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addIngredient}
          className="block w-full border-t border-stone-100 bg-stone-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-stone-100"
        >
          + Ajouter un ingrédient
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {saving ? "Enregistrement…" : "Enregistrer la recette"}
      </button>
    </div>
  );
}
