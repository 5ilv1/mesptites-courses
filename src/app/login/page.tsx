"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="text-sm text-stone-500">Chargement…</div>
    </main>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });

    if (sbError) {
      setStatus("error");
      setError(sbError.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-2xl">
            🛒
          </div>
          <h1 className="text-2xl font-semibold">Mes p&apos;tites courses</h1>
          <p className="mt-1 text-sm text-stone-600">
            Connecte-toi avec ton email — pas de mot de passe à retenir.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-900">
            <p className="font-medium">Lien envoyé ✉️</p>
            <p className="mt-1">
              Ouvre l&apos;email envoyé à <strong>{email}</strong> et clique sur
              le lien pour te connecter.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="ton@email.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-green-600"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              {status === "sending" ? "Envoi…" : "Recevoir le lien"}
            </button>
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
