import type { UcatInterfacePreferences } from "@/features/interface-preferences/model/types";

export async function fetchUcatInterfacePreferences(): Promise<UcatInterfacePreferences> {
  const response = await fetch("/api/ucat/interface-preferences", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Could not load interface preferences");
  }
  const body = (await response.json()) as {
    preferences: UcatInterfacePreferences;
  };
  return body.preferences;
}

export async function patchUcatInterfacePreferences(
  patch: Partial<UcatInterfacePreferences>,
): Promise<UcatInterfacePreferences> {
  const response = await fetch("/api/ucat/interface-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences: patch }),
  });
  if (!response.ok) {
    throw new Error("Could not save interface preferences");
  }
  const body = (await response.json()) as {
    preferences: UcatInterfacePreferences;
  };
  return body.preferences;
}
