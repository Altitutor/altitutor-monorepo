"use client";
import { useEffect, useState } from "react";
import { Button } from "@altitutor/ui";
import { useSupabaseClient } from "@/shared/lib/supabase/client";
import { LoginPageLayout } from "@/features/auth/components";

type Connection = { id: string; name: string; enabled: boolean };
export default function AdminAgentAccessPage() {
  const supabase = useSupabaseClient();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [message, setMessage] = useState("Loading connected applications…");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [access, oauth, grants] = await Promise.all([
        supabase.rpc("is_adminstaff_active"),
        supabase.auth.oauth.listGrants(),
        supabase.from("admin_mcp_grants").select("client_id"),
      ]);
      if (cancelled) return;
      if (access.error || access.data !== true) {
        setMessage("Active administrator access is required.");
        return;
      }
      if (oauth.error || grants.error) {
        setMessage("Unable to load application access. Please retry.");
        return;
      }
      setConnections(
        oauth.data.map((grant) => ({
          id: grant.client.id,
          name: grant.client.name,
          enabled: grants.data.some((row) => row.client_id === grant.client.id),
        })),
      );
      setMessage(
        oauth.data.length
          ? "Enable only applications you want to access business data and edit staff operations."
          : "Connect an application through OAuth first, then return here to enable admin access.",
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);
  async function toggle(connection: Connection) {
    setBusy(connection.id);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Sign in again.");
      const result = connection.enabled
        ? await supabase
            .from("admin_mcp_grants")
            .delete()
            .eq("user_id", data.user.id)
            .eq("client_id", connection.id)
        : await supabase
            .from("admin_mcp_grants")
            .upsert(
              { user_id: data.user.id, client_id: connection.id },
              { onConflict: "user_id,client_id", ignoreDuplicates: true },
            );
      if (result.error) throw result.error;
      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? { ...item, enabled: !item.enabled }
            : item,
        ),
      );
    } catch {
      setMessage("Unable to change access. Please retry.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <LoginPageLayout
      title="Admin application access"
      subtitle="Control business access for your connected agents."
      footer={null}
    >
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <p role="status" className="text-sm">
          {message}
        </p>
        <p className="text-sm text-muted-foreground">
          Enabled applications can read business and customer information,
          including financial records, messages and feedback, and edit staff
          projects, tasks, issues, documents and notes. Tutor-visible document
          changes take effect immediately.
        </p>
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="flex items-center justify-between gap-4 border-t pt-4"
          >
            <span>{connection.name}</span>
            <Button
              disabled={busy !== null}
              variant={connection.enabled ? "outline" : "default"}
              onClick={() => void toggle(connection)}
            >
              {connection.enabled
                ? "Revoke admin access"
                : "Enable admin access"}
            </Button>
          </div>
        ))}
      </div>
    </LoginPageLayout>
  );
}
