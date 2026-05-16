"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
};

type Props = {
  householdId: string;
  householdName: string;
  role: "owner" | "member";
  members: Member[];
};

export default function FoyerView({
  householdId,
  householdName,
  role,
  members,
}: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateInvite() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("create_invite", {
      p_household_id: householdId,
      p_default_display_name: defaultName.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    setInviteUrl(`${window.location.origin}/join/${data}`);
    setBusy(false);
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{householdName}</h2>
        <p className="text-sm text-stone-500">
          {members.length} membre{members.length > 1 ? "s" : ""}
        </p>
        <ul className="mt-3 divide-y divide-stone-100">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between py-2"
            >
              <div>
                <div className="font-medium">{m.display_name}</div>
                <div className="text-xs text-stone-500">
                  {m.role === "owner" ? "Propriétaire" : "Membre"} · depuis{" "}
                  {new Date(m.joined_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {role === "owner" && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="font-medium">Inviter quelqu&apos;un</h3>
          <p className="mt-1 text-sm text-stone-500">
            Génère un lien — la personne pourra rejoindre après s&apos;être
            connectée (lien valide 7 jours, usage unique).
          </p>

          <div className="mt-3 space-y-2">
            <input
              type="text"
              placeholder="Prénom suggéré (optionnel)"
              value={defaultName}
              onChange={(e) => setDefaultName(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-green-600"
            />
            <button
              onClick={generateInvite}
              disabled={busy}
              className="w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Génération…" : "Générer un lien d'invitation"}
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {inviteUrl && (
            <div className="mt-3 rounded-xl bg-stone-50 p-3">
              <div className="break-all text-xs text-stone-700">{inviteUrl}</div>
              <button
                onClick={copyInvite}
                className="mt-2 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white"
              >
                {copied ? "Copié ✓" : "Copier le lien"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
