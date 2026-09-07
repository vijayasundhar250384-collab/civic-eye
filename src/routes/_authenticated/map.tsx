import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, distanceMeters, STATUS_LABEL } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "3D location view — CivicLens" },
      {
        name: "description",
        content: "Tilted 3D view of every reported civic problem, with duplicate clusters.",
      },
      { property: "og:title", content: "3D location view — CivicLens" },
      {
        property: "og:description",
        content: "See reported civic problems on a tilted 3D city plane.",
      },
    ],
  }),
  component: MapPage,
});

export function MapPage() {
  const [tilt, setTilt] = useState(48);
  const [selected, setSelected] = useState<string | null>(null);

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

  const rows = useMemo(() => data ?? [], [data]);

  const pins = useMemo(() => {
    if (rows.length === 0) return [];
    const lats = rows.map((r) => r.latitude);
    const lngs = rows.map((r) => r.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.002);
    const spanLng = Math.max(maxLng - minLng, 0.002);
    return rows.map((r, i) => {
      const cluster = rows.filter(
        (o) => distanceMeters(r.latitude, r.longitude, o.latitude, o.longitude) < 40,
      ).length;
      return {
        report: r,
        cluster,
        left: 8 + ((r.longitude - minLng) / spanLng) * 84,
        top: 12 + (1 - (r.latitude - minLat) / spanLat) * 70,
        delay: i * 0.06,
      };
    });
  }, [rows]);

  const active = pins.find((p) => p.report.id === selected);

  return (
    <AppShell subtitle="3D location view">
      <Tile
        title="3D locations"
        right={
          <span className="font-mono text-[9px] font-semibold text-brand">
            TILT -{tilt}°
          </span>
        }
      >
        <div className="relative aspect-[16/12] overflow-hidden rounded-xl bg-gradient-to-b from-brand/15 via-surface to-muted">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(14,116,144,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(14,116,144,.25) 1px,transparent 1px)",
              backgroundSize: "26px 26px",
              transform: `perspective(400px) rotateX(${tilt}deg)`,
              transformOrigin: "center bottom",
            }}
          />
          {pins.map((p) => (
            <button
              key={p.report.id}
              onClick={() => setSelected(p.report.id)}
              className="animate-settle absolute -translate-x-1/2"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                animationDelay: `${p.delay}s`,
              }}
              aria-label={`${categoryLabel(p.report.category)} pin`}
            >
              {p.cluster > 1 ? (
                <span className="grid size-5 place-items-center rounded-full bg-frost font-mono text-[8px] font-bold text-brand ring-1 ring-border">
                  {p.cluster}
                </span>
              ) : (
                <span
                  className={`block size-3 rounded-full shadow-sm ring-2 ring-frost ${
                    p.report.status === "resolved"
                      ? "bg-ok"
                      : p.report.escalated
                        ? "bg-alert"
                        : "bg-brand"
                  }`}
                />
              )}
              <span
                className="mx-auto block w-px bg-ink/20"
                style={{ height: 10 + (tilt / 6) }}
              />
            </button>
          ))}
          <span className="absolute right-2 bottom-2 rounded-md bg-ink/45 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-frost">
            {rows.length} pins
          </span>
        </div>

        <label className="mt-2 block">
          <span className="label-cap">Tilt the view</span>
          <input
            type="range"
            min={0}
            max={70}
            value={tilt}
            onChange={(e) => setTilt(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--brand)]"
          />
        </label>
      </Tile>

      <Tile title="Selected pin">
        {active ? (
          <Link
            to="/reports/$id"
            params={{ id: active.report.id }}
            className="tile-solid block p-3"
          >
            <p className="text-[13px] font-bold text-ink">
              {categoryLabel(active.report.category)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {active.report.address || "Pinned location"} ·{" "}
              {active.report.area === "rural" ? "Rural" : "Urban"} ·{" "}
              {STATUS_LABEL[active.report.status]}
            </p>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              {active.report.latitude.toFixed(5)}, {active.report.longitude.toFixed(5)}
              {active.cluster > 1 ? ` · ${active.cluster} reports at this spot` : ""}
            </p>
          </Link>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Tap a pin to see the problem at that location.
          </p>
        )}
      </Tile>
    </AppShell>
  );
}
