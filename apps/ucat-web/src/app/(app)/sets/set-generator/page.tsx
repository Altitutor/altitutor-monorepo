import { redirect } from "next/navigation";
import { SetGeneratorPage } from "@/features/set-generator";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";

export default function SetGeneratorRoute() {
  if (!isSetGeneratorEnabled()) {
    redirect("/sets");
  }

  return <SetGeneratorPage />;
}
