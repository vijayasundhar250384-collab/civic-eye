import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Any report that is still open past its SLA is automatically turned into a
 * formal complaint against the in-charge officer, addressed to the corporation.
 */
export const runEscalationSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: open, error } = await supabaseAdmin
      .from("reports")
      .select("id, created_at, sla_hours, officer_id, status")
      .eq("escalated", false)
      .not("status", "in", "(resolved,rejected)");
    if (error) throw error;

    const due = (open ?? []).filter(
      (r) =>
        (Date.now() - new Date(r.created_at).getTime()) / 36e5 >= (r.sla_hours ?? 48),
    );
    if (due.length === 0) return { escalated: 0 };

    for (const report of due) {
      await supabaseAdmin
        .from("reports")
        .update({
          escalated: true,
          escalated_at: new Date().toISOString(),
          status: "escalated",
          escalation_note:
            "No action within SLA — automatic complaint raised against the in-charge officer with the Municipal Corporation Commissioner.",
        })
        .eq("id", report.id);

      await supabaseAdmin.from("report_events").insert({
        report_id: report.id,
        label: "Auto complaint raised",
        detail:
          "SLA breached. Complaint filed against the in-charge officer with the corporation.",
        kind: "alert",
      });
    }

    return { escalated: due.length };
  });
