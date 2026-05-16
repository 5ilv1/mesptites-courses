"use client";

import { createContext, useContext, type ReactNode } from "react";

export type HouseholdContext = {
  userId: string;
  householdId: string;
  householdName: string;
  displayName: string;
  role: "owner" | "member";
};

const Ctx = createContext<HouseholdContext | null>(null);

export function HouseholdProvider({
  value,
  children,
}: {
  value: HouseholdContext;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold(): HouseholdContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useHousehold must be used inside HouseholdProvider");
  }
  return ctx;
}
