import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { PhotoImg } from "@/hooks/usePhotoUrl";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, hoursSince, STATUS_LABEL, timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Report detail — CivicLens" },
      {
        name: "description",
        content:
          "Status timeline, assigned in-charge officer, escalation state and before/after photos of a civic report.",
      },
      { property: "og:title", content: "Report detail — CivicLens" },
      {
        property: "og:description",
        content: "Follow a civic report from filing to resolution.",
      },
    ],
  }),
  component: ReportDetail,
});

function ReportDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const [report, events] = await Promise.all([
        supabase.from("reports").select("*, officers(*)").eq("id", id).single(),
        supabase
          .from("report_events")
          .select("*")
          .eq("report_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (report.error) throw report.error;
      return { report: report.data, events: events.data ?? [] };
    },
  });

  async function uploadResolvedPhoto(file: File) {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expired.");
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("report-photos").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase
        .from("reports")
        .update({
          resolved_photo_url: path,
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("report_events").insert({
        report_id: id,
        label: "Resolved with proof photo",
        detail: "After-work photo uploaded and the report closed.",
        kind: "ok",
      });
      toast.success("Resolution photo saved.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <AppShell subtitle="Report detail">
        <Tile>
          <p className="text-[11px] text-muted-foreground">Loading report…</p>
        </Tile>
      </AppShell>
    );
  }

  const r = data.report;
  const officer = r.officers;
  const elapsed = Math.round(hoursSince(r.created_at));

  return (
    <AppShell subtitle={`Report · ${categoryLabel(r.category)}`}>
      <Tile
        title={`Status · ${STATUS_LABEL[r.status]}`}
        right={
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[9px] font-semibold ${
              r.status === "resolved"
                ? "bg-ok/12 text-ok"
                : r.escalated
                  ? "bg-alert/12 text-alert"
                  : "bg-accent/12 text-accent"
            }`}
          >
            {r.escalated ? "COMPLAINT RAISED" : `${elapsed}h / ${r.sla_hours}h SLA`}
          </span>
        }
      >
        <PhotoImg
          path={r.photo_url}
          alt={`${categoryLabel(r.category)} reported`}
          className="aspect-[4/3] w-full rounded-xl object-cover"
        />
        <p className="mt-2 text-[13px] font-bold text-ink">{categoryLabel(r.category)}</p>
        <p className="text-[10px] text-muted-foreground">
          {r.area === "rural" ? "Rural" : "Urban"} · {r.address || "Pinned location"} ·{" "}
          {timeAgo(r.created_at)}
        </p>
        {r.description && (
          <p className="mt-1.5 text-[11px] text-ink">{r.description}</p>
        )}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Fact
            label="AI verdict"
            value={r.ai_verified ? "Original" : "Review"}
            tone={r.ai_verified ? "text-ok" : "text-alert"}
          />
          <Fact label="Confidence" value={`${r.ai_confidence}%`} tone="text-brand" />
          <Fact label="Severity" value={r.severity} tone="text-accent" />
        </div>
        {r.ai_notes && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">{r.ai_notes}</p>
        )}
      </Tile>

      <Tile title="In-charge officer">
        {officer ? (
          <div className="tile-solid p-3">
            <p className="text-[13px] font-bold text-ink">{officer.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {officer.designation} · {officer.department}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">
              {officer.ward} · {officer.contact}
            </p>
            {r.escalated && (
              <p className="mt-2 rounded-lg bg-alert/10 p-2 text-[10px] font-semibold text-alert">
                No action within {r.sla_hours}h — complaint raised against this officer with
                the {officer.escalation_authority}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No officer mapped for this category yet.
          </p>
        )}
      </Tile>

      <Tile title="Timeline">
        <div className="relative space-y-3 pl-5">
          <span className="absolute top-1 bottom-1 left-1.5 w-px bg-border" />
          {data.events.map((e) => (
            <div key={e.id} className="relative">
              <span
                className={`absolute top-1 -left-[18px] size-3 rounded-full ${
                  e.kind === "alert"
                    ? "bg-alert"
                    : e.kind === "ok"
                      ? "bg-ok"
                      : e.kind === "warn"
                        ? "bg-accent"
                        : "bg-brand"
                }`}
              />
              <p className="text-[12px] font-semibold text-ink">{e.label}</p>
              <p className="font-mono text-[9px] text-muted-foreground">
                {new Date(e.created_at).toLocaleString()} · {e.detail}
              </p>
            </div>
          ))}
        </div>
      </Tile>

      <Tile title="Before / after">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="label-cap mb-1">Before</p>
            <PhotoImg
              path={r.photo_url}
              alt="Problem before work"
              className="aspect-square w-full rounded-lg object-cover"
            />
          </div>
          <div>
            <p className="label-cap mb-1">After</p>
            {r.resolved_photo_url ? (
              <PhotoImg
                path={r.resolved_photo_url}
                alt="Location after the work was done"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="grid aspect-square w-full place-items-center rounded-lg bg-frost/70 text-[10px] font-semibold text-brand ring-1 ring-border"
              >
                {busy ? "Uploading…" : "Add resolved photo"}
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadResolvedPhoto(file);
          }}
        />
      </Tile>

      <Link
        to="/reports"
        className="block rounded-lg bg-frost/70 py-2.5 text-center text-[11px] font-semibold text-ink ring-1 ring-border"
      >
        Back to all reports
      </Link>
    </AppShell>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="tile-solid p-2">
      <p className="text-[9px] font-medium text-muted-foreground">{label}</p>
      <p className={`text-[12px] font-bold capitalize ${tone}`}>{value}</p>
    </div>
  );
}
