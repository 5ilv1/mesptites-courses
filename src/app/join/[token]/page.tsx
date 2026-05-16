import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import JoinForm from "./JoinForm";

type Props = { params: Promise<{ token: string }> };

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  await requireUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("peek_invite", { p_token: token })
    .maybeSingle();

  if (error || !data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Invitation introuvable</h1>
          <p className="mt-2 text-sm text-stone-600">
            Ce lien d&apos;invitation n&apos;existe pas.
          </p>
        </div>
      </main>
    );
  }

  if (data.expired || data.used) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">
            {data.used ? "Invitation déjà utilisée" : "Invitation expirée"}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Demande à la personne qui t&apos;a invité de regénérer un lien.
          </p>
        </div>
      </main>
    );
  }

  // If already a member, skip and go straight to /list
  const supabaseUser = await supabase.auth.getUser();
  if (supabaseUser.data.user) {
    const { data: existing } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("household_id", data.household_id)
      .eq("user_id", supabaseUser.data.user.id)
      .maybeSingle();
    if (existing) redirect("/list");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <JoinForm
        token={token}
        householdName={data.household_name ?? ""}
        defaultDisplayName={data.default_display_name ?? ""}
      />
    </main>
  );
}
