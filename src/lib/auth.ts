import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentHousehold() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, display_name, role, households(id, name)")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    householdId: data.household_id,
    householdName:
      (data.households as unknown as { name: string } | null)?.name ?? "",
    displayName: data.display_name,
    role: data.role,
  };
}

export async function requireHousehold() {
  const user = await requireUser();
  const hh = await getCurrentHousehold();
  if (!hh) redirect("/onboarding");
  return { user, household: hh };
}
