"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  householdName: string;
  defaultDisplayName: string;
};

export default function JoinForm({
  token,
  householdName,
  defaultDisplayName,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("redeem_invite", {
      p_token: token,
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
      <h1 className="text-2xl font-semibold">
        Rejoindre <span className="text-green-700">{householdName}</span>
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Choisis le prénom qui apparaîtra dans le foyer.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="text"
          required
          placeholder="Ton prénom"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-green-600"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {busy ? "…" : "Rejoindre le foyer"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
