import { redirect } from "next/navigation";
import { isSetGeneratorEnabled } from "@/lib/feature-flags";

export default function SetGeneratorRedirect() {
  if (!isSetGeneratorEnabled()) {
    redirect("/sets");
  }

  redirect("/sets/set-generator");
}
