import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/officers")({
  head: () => ({
    meta: [
      { title: "In-charge officers & escalations — CivicLens" },
      {
        name: "description",
        content:
          "Department officers responsible for each civic problem, and the complaints raised with the corporation when they do not act.",
      },
      { property: "og:title", content: "In-charge officers & escalations — CivicLens" },
      {
        property: "og:description",
        content: "Who is responsible for each civic problem, and open escalations.",
      },
    ],
  }),
  component: OfficersPage,
});

function OfficersPage() {
  const officers = useQuery({
    queryKey: ["officers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("officers").select("*").order("area");
      if (error) throw error;
      return data;
    },
  });

  const escalations = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, officers(name, designation, escalation_authority)")
        .eq("escalated", true)
        .order("escalated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell subtitle="Escalation desk">
      <Tile
        title="Complaints raised"
        right={
          <span className="font-mono text-[9px] font-semibold text-alert">
            {escalations.data?.length ?? 0} OPEN
          </span>
        }
      >
        <div className="space-y-2">
          {(escalations.data ?? []).map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="tile-solid block p-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-ink">
                  {categoryLabel(r.category)} · {r.address || "Pinned location"}
                </p>
                <span className="font-mono text-[8px] font-semibold text-alert">
                  ESCALATED
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Against {r.officers?.name ?? "unassigned officer"} (
                {r.officers?.designation ?? "—"}) ·{" "}
                {r.escalated_at ? timeAgo(r.escalated_at) : ""}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-alert">
                Filed with the {r.officers?.escalation_authority ?? "Corporation"}
              </p>
            </Link>
          ))}
          {(escalations.data ?? []).length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              No overdue reports. Every issue is inside its action window.
            </p>
          )}
        </div>
      </Tile>

      <Tile title="Who is in charge">
        <div className="space-y-2">
          {(officers.data ?? []).map((o) => (
            <div key={o.id} className="tile-solid p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-ink">{o.name}</p>
                <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[9px] font-semibold text-brand">
                  {categoryLabel(o.category)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {o.designation} · {o.department}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground">
                {o.ward} · {o.area === "rural" ? "Rural" : "Urban"} · {o.contact}
              </p>
            </div>
          ))}
        </div>
      </Tile>
    </AppShell>
  );
}
