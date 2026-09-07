import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Tile } from "@/components/AppShell";
import { PhotoImg } from "@/hooks/usePhotoUrl";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel, STATUS_LABEL, timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "All reports — CivicLens" },
      {
        name: "description",
        content:
          "Every civic report with its status, category, area and before/after photos.",
      },
      { property: "og:title", content: "All reports — CivicLens" },
      {
        property: "og:description",
        content: "Track civic reports from submitted to resolved.",
      },
    ],
  }),
  component: ReportsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "escalated", label: "Escalated" },
  { key: "urban", label: "Urban" },
  { key: "rural", label: "Rural" },
] as const;

function ReportsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data } = useQuery({
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

  const rows = (data ?? []).filter((r) => {
    const byFilter =
      filter === "all"
        ? true
        : filter === "open"
          ? r.status !== "resolved"
          : filter === "resolved"
            ? r.status === "resolved"
            : filter === "escalated"
              ? r.escalated
              : r.area === filter;
    const byCategory = category === "all" ? true : r.category === category;
    return byFilter && byCategory;
  });

  return (
    <AppShell subtitle="All reports">
      <Tile title="Filters">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ring-1 ${
                filter === f.key
                  ? "bg-brand text-brand-foreground ring-brand"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ring-1 ${
              category === "all"
                ? "bg-ink text-frost ring-ink"
                : "bg-frost/70 text-ink ring-border"
            }`}
          >
            Every type
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ring-1 ${
                category === c.value
                  ? "bg-ink text-frost ring-ink"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Tile>

      <Tile
        title={`${rows.length} report${rows.length === 1 ? "" : "s"}`}
        right={
          <Link to="/capture" className="text-[10px] font-semibold text-brand">
            New capture
          </Link>
        }
      >
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="tile-solid block p-2"
            >
              <div className="flex items-center gap-2.5">
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
                    {r.area === "rural" ? "Rural" : "Urban"} ·{" "}
                    {r.address || "Pinned location"} · {timeAgo(r.created_at)}
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
              </div>
              {r.escalated && (
                <p className="mt-1.5 pl-[58px] text-[9px] font-semibold text-alert">
                  Auto complaint raised with the corporation
                </p>
              )}
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              Nothing matches these filters yet.
            </p>
          )}
        </div>
      </Tile>
    </AppShell>
  );
}
