"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("Famille");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_household", {
      p_name: name.trim() || "Famille",
      p_display_name: displayName.trim(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    router.replace("/list");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold">Crée ton foyer</h1>
      <p className="mt-1 text-sm text-stone-600">
        Un foyer regroupe les membres qui partagent le planning et la liste.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Nom du foyer</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-green-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ton prénom</label>
          <input
            type="text"
            required
            placeholder="Comment t'appelle-t-on ?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-green-600"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {busy ? "Création…" : "Créer le foyer"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <p className="mt-6 text-center text-xs text-stone-500">
        Tu as reçu un lien d&apos;invitation ? Ouvre-le pour rejoindre un foyer
        existant.
      </p>
    </div>
  );
}
