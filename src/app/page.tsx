import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/auth";

export default async function Home() {
  await requireHousehold();
  redirect("/list");
}
