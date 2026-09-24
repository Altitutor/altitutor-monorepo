export async function subscribeToUcatNewsletter(
  source = "ucat_signup",
): Promise<void> {
  try {
    const response = await fetch("/api/ucat/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    if (!response.ok) {
      console.warn(
        "[signup] Failed to save newsletter preference:",
        response.status,
      );
    }
  } catch (error) {
    console.warn("[signup] Failed to save newsletter preference:", error);
  }
}
