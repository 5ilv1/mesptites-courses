import { requireHousehold } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import FoyerView from "./FoyerView";

export default async function FoyerPage() {
  const { household } = await requireHousehold();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, display_name, role, joined_at")
    .eq("household_id", household.householdId)
    .order("joined_at", { ascending: true });

  return (
    <FoyerView
      householdId={household.householdId}
      householdName={household.householdName}
      role={household.role}
      members={members ?? []}
    />
  );
}
