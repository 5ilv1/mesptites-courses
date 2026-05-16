import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold">Lien invalide</h1>
        <p className="mt-2 text-sm text-stone-600">
          Le lien de connexion est invalide ou a expiré. Réessaye en demandant
          un nouveau lien.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white"
        >
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
