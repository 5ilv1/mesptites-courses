"use client";

import { useMemo, useState } from "react";
import { useHousehold } from "@/lib/HouseholdContext";
import {
  useMealPlans,
  upsertMealPlan,
  deleteMealPlan,
} from "@/lib/hooks/useMealPlans";
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

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MealPlanner() {
  const { userId, householdId } = useHousehold();
  const [weekOffset, setWeekOffset] = useState(0);

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
    const m = new Map<string, MealPlanRow>();
    for (const p of plans) m.set(`${p.date}::${p.slot}`, p);
    return m;
  }, [plans]);

  return (
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

      <div className="space-y-2">
        {days.map((d) => {
          const dateStr = isoDate(d);
          const isToday = dateStr === isoDate(new Date());
          return (
            <div
              key={dateStr}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                isToday ? "border-green-500 ring-1 ring-green-200" : "border-stone-200"
              }`}
            >
              <div className="flex items-baseline justify-between border-b border-stone-100 px-4 py-2">
                <div className="font-medium">
                  {DAY_LABELS[d.getDay()]}{" "}
                  <span className="text-sm text-stone-500">
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                </div>
                {isToday && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Aujourd&apos;hui
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 divide-x divide-stone-100">
                <SlotCell
                  label="Midi"
                  slot="lunch"
                  date={dateStr}
                  householdId={householdId}
                  userId={userId}
                  plan={plansByKey.get(`${dateStr}::lunch`)}
                />
                <SlotCell
                  label="Soir"
                  slot="dinner"
                  date={dateStr}
                  householdId={householdId}
                  userId={userId}
                  plan={plansByKey.get(`${dateStr}::dinner`)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotCell({
  label,
  slot,
  date,
  householdId,
  userId,
  plan,
}: {
  label: string;
  slot: "lunch" | "dinner";
  date: string;
  householdId: string;
  userId: string;
  plan: MealPlanRow | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(plan?.title ?? "");

  async function save() {
    const v = value.trim();
    if (!v) {
      if (plan) await deleteMealPlan(plan.id);
    } else {
      await upsertMealPlan({
        id: plan?.id ?? crypto.randomUUID(),
        household_id: householdId,
        date,
        slot,
        title: v,
        notes: plan?.notes ?? null,
        created_by: plan?.created_by ?? userId,
      });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="p-2">
        <div className="text-[10px] uppercase tracking-wide text-stone-400">
          {label}
        </div>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(plan?.title ?? "");
              setEditing(false);
            }
          }}
          className="mt-1 w-full rounded-lg border border-green-600 px-2 py-1 text-sm outline-none"
          placeholder="Quel plat ?"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(plan?.title ?? "");
        setEditing(true);
      }}
      className="block w-full p-2 text-left transition hover:bg-stone-50"
    >
      <div className="text-[10px] uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${plan ? "text-stone-900" : "text-stone-400"}`}
      >
        {plan?.title ?? "+ Ajouter"}
      </div>
    </button>
  );
}
