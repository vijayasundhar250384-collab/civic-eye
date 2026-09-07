import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell, Tile } from "@/components/AppShell";
import { PhotoImg } from "@/hooks/usePhotoUrl";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, STATUS_LABEL, timeAgo } from "@/lib/civic";
import { runEscalationSweep } from "@/lib/escalation.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CivicLens" },
      {
        name: "description",
        content: "Live count of civic reports filed, resolved and escalated in your ward.",
      },
      { property: "og:title", content: "Dashboard — CivicLens" },
      {
        property: "og:description",
        content: "Live civic reporting statistics for your ward.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    runEscalationSweep().then((res) => {
      if (res.escalated > 0) reports.refetch();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = reports.data ?? [];
  const total = rows.length;
  const resolved = rows.filter((r) => r.status === "resolved").length;
  const escalated = rows.filter((r) => r.escalated).length;
  const rate = total ? Math.round((resolved / total) * 100) : 0;
  const latestEscalation = rows.find((r) => r.escalated);

  return (
    <AppShell subtitle="Field reporting · overview">
      <div className="grid grid-cols-2 gap-3">
        <Tile
          title="Dashboard"
          right={<span className="font-mono text-[9px] font-semibold text-brand">LIVE</span>}
          className="col-span-2"
        >
          <div className="grid grid-cols-4 gap-1.5">
            <Stat value={total} label="Reports" tone="brand" />
            <Stat value={resolved} label="Resolved" tone="ok" />
            <Stat value={escalated} label="Escalated" tone="alert" />
            <Stat value={`${rate}%`} label="Resolution" tone="accent" />
          </div>
          {latestEscalation && (
            <Link
              to="/reports/$id"
              params={{ id: latestEscalation.id }}
              className="tile-solid mt-2 block p-2"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[9px] font-medium text-muted-foreground">
                  {categoryLabel(latestEscalation.category)} · {latestEscalation.address || "Unmapped"}
                </p>
                <span className="font-mono text-[8px] font-semibold text-alert">ESCALATED</span>
              </div>
              <p className="text-[10px] font-semibold text-ink">
                Auto complaint filed with the corporation
              </p>
            </Link>
          )}
        </Tile>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/capture" className="tile flex flex-col justify-between p-3">
          <p className="label-cap">Report an issue</p>
          <p className="mt-3 text-[13px] font-bold text-ink">Open camera</p>
          <p className="text-[10px] text-muted-foreground">
            Photo + GPS + AI check in one step
          </p>
          <span className="mt-2 inline-flex w-fit rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-brand-foreground">
            Capture
          </span>
        </Link>
        <Link to="/map" className="tile p-3">
          <p className="label-cap">3D locations</p>
          <div className="relative mt-2 aspect-square overflow-hidden rounded-xl bg-gradient-to-b from-brand/15 via-surface to-muted">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(14,116,144,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(14,116,144,.25) 1px,transparent 1px)",
                backgroundSize: "22px 22px",
                transform: "perspective(400px) rotateX(48deg)",
                transformOrigin: "center bottom",
              }}
            />
            <span className="absolute right-2 bottom-2 rounded-md bg-ink/45 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-frost">
              {total} pins
            </span>
          </div>
        </Link>
      </div>

      <Tile
        title="Latest reports"
        right={
          <Link to="/reports" className="text-[10px] font-semibold text-brand">
            See all
          </Link>
        }
      >
        <div className="space-y-2">
          {rows.slice(0, 4).map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="tile-solid flex items-center gap-2.5 p-2"
            >
              <PhotoImg
                path={r.photo_url}
                alt={categoryLabel(r.category)}
                className="size-12 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-ink">
                  {categoryLabel(r.category)}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {r.area === "rural" ? "Rural" : "Urban"} · {r.address || "Location pinned"} ·{" "}
                  {timeAgo(r.created_at)}
                </p>
              </div>
              <span
                className={`rounded-lg px-2 py-1 text-[9px] font-bold ${
                  r.status === "resolved"
                    ? "bg-ok/12 text-ok"
                    : r.escalated
                      ? "bg-alert/12 text-alert"
                      : "bg-accent/12 text-accent"
                }`}
              >
                {STATUS_LABEL[r.status]}
              </span>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              No reports yet. Capture the first civic issue.
            </p>
          )}
        </div>
      </Tile>
    </AppShell>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: "brand" | "ok" | "alert" | "accent";
}) {
  const tones = {
    brand: "bg-brand/8 ring-brand/15 text-brand",
    ok: "bg-ok/8 ring-ok/15 text-ok",
    alert: "bg-alert/8 ring-alert/15 text-alert",
    accent: "bg-accent/8 ring-accent/15 text-accent",
  }[tone];
  return (
    <div className={`rounded-lg p-2 ring-1 ${tones}`}>
      <p className="font-mono text-lg leading-none font-extrabold">{value}</p>
      <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
