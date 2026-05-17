"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useHousehold } from "@/lib/HouseholdContext";
import {
  useMealPlans,
  upsertMealPlan,
  deleteMealPlan,
  moveMealPlan,
} from "@/lib/hooks/useMealPlans";
import { useRecipes, planRecipe } from "@/lib/hooks/useRecipes";
import type { MealPlanRow } from "@/lib/supabase/types";

const DAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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

type SlotKey = `${string}::${"lunch" | "dinner"}`;

type SlotTarget = {
  date: string;
  slot: "lunch" | "dinner";
  current: MealPlanRow | undefined;
};

export default function MealPlanner() {
  const { userId, householdId } = useHousehold();
  const [weekOffset, setWeekOffset] = useState(0);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const { recipes } = useRecipes(householdId);

  const monday = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      }),
    [monday]
  );

  const isoDates = useMemo(() => days.map(isoDate), [days]);
  const plans = useMealPlans(householdId, isoDates);

  const plansByKey = useMemo(() => {
    const m = new Map<SlotKey, MealPlanRow>();
    for (const p of plans) m.set(`${p.date}::${p.slot}` as SlotKey, p);
    return m;
  }, [plans]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    })
  );

  async function handleDragEnd(e: DragEndEvent) {
    setMoveError(null);
    const { active, over } = e;
    if (!over) return;
    const activeKey = String(active.id) as SlotKey;
    const overKey = String(over.id) as SlotKey;
    if (activeKey === overKey) return;

    const source = plansByKey.get(activeKey);
    if (!source) return;

    const targetPlan = plansByKey.get(overKey);
    if (targetPlan) {
      setMoveError(
        "Ce créneau est déjà occupé. Vide-le d'abord (croix rouge), puis recommence."
      );
      return;
    }

    const [newDate, newSlot] = overKey.split("::") as [
      string,
      "lunch" | "dinner",
    ];
    try {
      await moveMealPlan(source.id, newDate, newSlot);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Erreur de déplacement");
    }
  }

  async function handleQuickDelete(plan: MealPlanRow) {
    await deleteMealPlan(plan.id);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-100"
          >
            ← Semaine
          </button>
          <h2 className="text-sm font-medium text-stone-600">
            {monday.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {days[6].toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </h2>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-100"
          >
            Semaine →
          </button>
        </div>

        {moveError && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {moveError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => {
            const dateStr = isoDate(d);
            const isToday = dateStr === isoDate(new Date());
            return (
              <div
                key={dateStr}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  isToday
                    ? "border-green-500 ring-1 ring-green-200"
                    : "border-stone-200"
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b border-stone-100 px-3 py-2 ${
                    isToday ? "bg-green-50" : ""
                  }`}
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-stone-500">
                      <span className="lg:hidden">{DAY_LABELS[d.getDay()]}</span>
                      <span className="hidden lg:inline">
                        {DAY_SHORT[d.getDay()]}
                      </span>
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </div>
                  {isToday && (
                    <span
                      title="Aujourd'hui"
                      className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
                    >
                      •
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col divide-y divide-stone-100">
                  <SlotCell
                    slotKey={`${dateStr}::lunch`}
                    label="Midi"
                    plan={plansByKey.get(`${dateStr}::lunch`)}
                    onOpen={() =>
                      setTarget({
                        date: dateStr,
                        slot: "lunch",
                        current: plansByKey.get(`${dateStr}::lunch`),
                      })
                    }
                    onQuickDelete={handleQuickDelete}
                  />
                  <SlotCell
                    slotKey={`${dateStr}::dinner`}
                    label="Soir"
                    plan={plansByKey.get(`${dateStr}::dinner`)}
                    onOpen={() =>
                      setTarget({
                        date: dateStr,
                        slot: "dinner",
                        current: plansByKey.get(`${dateStr}::dinner`),
                      })
                    }
                    onQuickDelete={handleQuickDelete}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-stone-500">
          Astuce : maintiens-clique (ou appui long sur mobile) un repas pour le
          déplacer vers un autre créneau.
        </p>
      </div>

      {target && (
        <SlotEditor
          target={target}
          householdId={householdId}
          userId={userId}
          recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setTarget(null)}
        />
      )}
    </DndContext>
  );
}

function SlotCell({
  slotKey,
  label,
  plan,
  onOpen,
  onQuickDelete,
}: {
  slotKey: SlotKey;
  label: string;
  plan: MealPlanRow | undefined;
  onOpen: () => void;
  onQuickDelete: (plan: MealPlanRow) => void | Promise<void>;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: slotKey });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: slotKey,
    disabled: !plan,
  });

  const setRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const acceptingDrop = isOver && !plan;
  const refusingDrop = isOver && plan;

  return (
    <div
      ref={setRef}
      className={`relative flex-1 transition ${
        isDragging ? "opacity-40" : ""
      } ${acceptingDrop ? "bg-green-50 ring-2 ring-inset ring-green-400" : ""} ${
        refusingDrop ? "bg-red-50 ring-2 ring-inset ring-red-300" : ""
      }`}
    >
      <button
        onClick={onOpen}
        {...(plan ? listeners : {})}
        {...(plan ? attributes : {})}
        className="block w-full p-2 pr-7 text-left transition hover:bg-stone-50 touch-none"
      >
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-stone-400">
          <span>{label}</span>
          {plan?.recipe_id && (
            <span title="Issue d'une recette enregistrée">📖</span>
          )}
        </div>
        <div
          className={`mt-1 line-clamp-2 text-sm leading-tight ${plan ? "text-stone-900" : "text-stone-400"}`}
        >
          {plan?.title ?? "+ Ajouter"}
        </div>
      </button>

      {plan && (
        <button
          type="button"
          aria-label={`Supprimer ${label.toLowerCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            onQuickDelete(plan);
          }}
          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-stone-300 transition hover:bg-red-100 hover:text-red-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

function SlotEditor({
  target,
  householdId,
  userId,
  recipes,
  onClose,
}: {
  target: SlotTarget;
  householdId: string;
  userId: string;
  recipes: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"text" | "recipe">(
    target.current?.recipe_id ? "recipe" : "text"
  );
  const [title, setTitle] = useState(
    target.current?.recipe_id ? "" : target.current?.title ?? ""
  );
  const [recipeId, setRecipeId] = useState<string>(
    target.current?.recipe_id ?? recipes[0]?.id ?? ""
  );
  const [addToShopping, setAddToShopping] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      if (mode === "recipe") {
        if (!recipeId) {
          setBusy(false);
          return;
        }
        await planRecipe({
          household_id: householdId,
          date: target.date,
          slot: target.slot,
          recipe_id: recipeId,
          add_to_shopping: addToShopping,
        });
      } else {
        const v = title.trim();
        if (!v) {
          if (target.current) await deleteMealPlan(target.current.id);
        } else {
          await upsertMealPlan({
            id: target.current?.id ?? crypto.randomUUID(),
            household_id: householdId,
            date: target.date,
            slot: target.slot,
            title: v,
            notes: target.current?.notes ?? null,
            recipe_id: null,
            created_by: target.current?.created_by ?? userId,
          });
        }
      }
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    if (target.current) await deleteMealPlan(target.current.id);
    onClose();
  }

  const slotLabel = target.slot === "lunch" ? "Midi" : "Soir";
  const dateLabel = new Date(target.date + "T12:00:00").toLocaleDateString(
    "fr-FR",
    { weekday: "long", day: "numeric", month: "long" }
  );

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wide text-stone-500">
            {slotLabel} · {dateLabel}
          </div>
          <h3 className="text-lg font-semibold capitalize">Que cuisine-t-on ?</h3>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button
            onClick={() => setMode("text")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === "text"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500"
            }`}
          >
            Texte libre
          </button>
          <button
            onClick={() => setMode("recipe")}
            disabled={recipes.length === 0}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              mode === "recipe"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500"
            }`}
          >
            Recette enregistrée
          </button>
        </div>

        {mode === "text" ? (
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Pâtes au pesto"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-green-600"
          />
        ) : (
          <div className="space-y-2">
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-green-600"
            >
              {recipes.length === 0 ? (
                <option value="">Aucune recette enregistrée</option>
              ) : (
                recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={addToShopping}
                onChange={(e) => setAddToShopping(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300"
              />
              Ajouter les ingrédients à la liste de courses
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                />
                Enregistrement…
              </span>
            ) : (
              "Enregistrer"
            )}
          </button>
          {target.current && (
            <button
              onClick={handleClear}
              disabled={busy}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              Vider
            </button>
          )}
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-3 py-2.5 text-sm text-stone-500 hover:bg-stone-100"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
