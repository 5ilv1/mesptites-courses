import Link from "next/link";
import { requireHousehold } from "@/lib/auth";
import RegisterPWA from "@/components/RegisterPWA";
import { HouseholdProvider } from "@/lib/HouseholdContext";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, household } = await requireHousehold();

  return (
    <HouseholdProvider
      value={{
        userId: user.id,
        householdId: household.householdId,
        householdName: household.householdName,
        displayName: household.displayName,
        role: household.role,
      }}
    >
      <RegisterPWA />
      <div className="flex min-h-screen flex-1 flex-col pb-20">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="text-sm text-stone-500">
              <span className="font-medium text-stone-900">
                {household.householdName}
              </span>
              <span className="mx-2">·</span>
              <span>{household.displayName}</span>
            </div>
            <form action="/api/logout" method="post">
              <button
                type="submit"
                className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
          {children}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-stone-200 bg-white">
          <div
            className="mx-auto grid max-w-6xl grid-cols-4"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <NavLink href="/list" label="Liste" icon="🛒" />
            <NavLink href="/planning" label="Repas" icon="🍽️" />
            <NavLink href="/recipes" label="Recettes" icon="📖" />
            <NavLink href="/foyer" label="Foyer" icon="👨‍👩‍👦" />
          </div>
        </nav>
      </div>
    </HouseholdProvider>
  );
}

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 py-2 text-xs text-stone-600 transition hover:text-green-700"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
