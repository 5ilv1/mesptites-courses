import { redirect } from "next/navigation";
import { requireUser, getCurrentHousehold } from "@/lib/auth";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  await requireUser();
  const existing = await getCurrentHousehold();
  if (existing) redirect("/list");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <OnboardingForm />
    </main>
  );
}
