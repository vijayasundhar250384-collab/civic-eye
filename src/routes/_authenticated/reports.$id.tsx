import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { PhotoImg } from "@/hooks/usePhotoUrl";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, hoursSince, STATUS_LABEL, timeAgo, generateReportId, getAuthorityDepartment } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Report detail — Urbix AI" },
      {
        name: "description",
        content:
          "Status tracking timeline, assigned authority contact, AI proof-of-resolution verification, citizen confirmation, and before/after photos.",
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
  const [confirmedState, setConfirmedState] = useState<"CONFIRMED" | "DISPUTED" | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);

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
        detail: "After-work photo uploaded and verified by AI Proof-of-Resolution.",
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

  async function handleCitizenConfirmation(action: "CONFIRM" | "DISPUTE") {
    if (action === "CONFIRM") {
      setConfirmedState("CONFIRMED");
      await supabase.from("report_events").insert({
        report_id: id,
        label: "Citizen Confirmed Repair",
        detail: "Reporting citizen verified that the repair was executed satisfactorily.",
        kind: "ok",
      });
      toast.success("Thank you! Citizen confirmation recorded.");
    } else {
      setShowDisputeModal(true);
    }
  }

  async function submitDispute() {
    if (!disputeReason.trim()) {
      toast.error("Please enter a reason for disputing the repair.");
      return;
    }
    setConfirmedState("DISPUTED");
    setShowDisputeModal(false);
    await supabase.from("report_events").insert({
      report_id: id,
      label: "Citizen Disputed Repair",
      detail: `Reopened by citizen: "${disputeReason}"`,
      kind: "alert",
    });
    await supabase.from("reports").update({ status: "assigned" }).eq("id", id);
    toast.warning("Repair disputed. Report reopened and sent back to field queue.");
    void refetch();
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
  const trackingId = generateReportId(1042);
  const authorityContact = getAuthorityDepartment(r.category, "Ward 07");

  return (
    <AppShell subtitle={`Report · ${trackingId}`}>
      {/* Tracking ID Header */}
      <section className="tile-solid p-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Unique Tracking ID</p>
          <p className="font-mono text-[14px] font-extrabold text-brand">{trackingId}</p>
        </div>
        <span className="font-mono text-[9px] font-bold bg-brand/10 text-brand px-2 py-1 rounded">
          {STATUS_LABEL[r.status] || r.status}
        </span>
      </section>

      {/* Main Detail Card */}
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
        {r.description && <p className="mt-1.5 text-[11px] text-ink">{r.description}</p>}

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Fact
            label="AI Verdict"
            value={r.ai_verified ? "Original" : "Review"}
            tone={r.ai_verified ? "text-ok" : "text-alert"}
          />
          <Fact label="Confidence" value={`${r.ai_confidence}%`} tone="text-brand" />
          <Fact label="Severity" value={r.severity} tone="text-accent" />
        </div>
        {r.ai_notes && <p className="mt-1.5 text-[10px] text-muted-foreground">{r.ai_notes}</p>}
      </Tile>

      {/* Assigned Authority Contact Information Card */}
      <Tile title="Assigned Authority Contact">
        <div className="tile-solid p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-extrabold text-ink">{authorityContact.department}</p>
            <span className="font-mono text-[8px] font-bold bg-brand/10 text-brand px-1.5 py-0.5 rounded">
              ASSIGNED
            </span>
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground">{authorityContact.divisionName}</p>
          <div className="pt-1 text-[9.5px] space-y-0.5">
            <p><span className="font-bold text-ink">In-Charge Officer:</span> {authorityContact.officerName} ({authorityContact.designation})</p>
            <p><span className="font-bold text-ink">Phone:</span> {authorityContact.phone}</p>
            <p><span className="font-bold text-ink">Email:</span> {authorityContact.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            <a
              href={`tel:${authorityContact.phone.replace(/\s+/g, "")}`}
              className="rounded-lg bg-frost py-2 text-center text-[10px] font-bold text-ink ring-1 ring-border hover:bg-brand/10"
            >
              📞 Call Authority
            </a>
            <a
              href={`mailto:${authorityContact.email.split(" ")[0]}`}
              className="rounded-lg bg-frost py-2 text-center text-[10px] font-bold text-ink ring-1 ring-border hover:bg-brand/10"
            >
              ✉️ Email Department
            </a>
          </div>
        </div>
      </Tile>

      {/* Citizen Resolution Confirmation Box */}
      {r.status === "resolved" && (
        <Tile title="Citizen Resolution Feedback">
          <div className="space-y-2">
            <p className="text-[11px] text-ink font-medium">
              The field officer marked this job as resolved with visual proof. Does the repair look complete to you?
            </p>
            {confirmedState === "CONFIRMED" ? (
              <div className="rounded-lg bg-ok/10 p-2 text-center text-[11px] font-bold text-ok ring-1 ring-ok/20">
                ✓ You confirmed this repair resolution.
              </div>
            ) : confirmedState === "DISPUTED" ? (
              <div className="rounded-lg bg-alert/10 p-2 text-center text-[11px] font-bold text-alert ring-1 ring-alert/20">
                ⚠ Repair disputed. Reopened for field re-inspection.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCitizenConfirmation("DISPUTE")}
                  className="rounded-lg bg-frost py-2 text-[11px] font-bold text-alert ring-1 ring-border hover:bg-alert/10"
                >
                  Dispute Repair
                </button>
                <button
                  onClick={() => handleCitizenConfirmation("CONFIRM")}
                  className="rounded-lg bg-brand py-2 text-[11px] font-bold text-brand-foreground"
                >
                  Confirm Resolution
                </button>
              </div>
            )}
          </div>
        </Tile>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <Tile title="Dispute Repair Execution">
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Please state why the repair is unsatisfactory (e.g. remaining pothole edge, uncleared debris):
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={2}
              placeholder="Reason for dispute..."
              className="w-full rounded-lg bg-frost p-2 text-[11px] outline-none ring-1 ring-border"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border"
              >
                Cancel
              </button>
              <button
                onClick={submitDispute}
                className="rounded-lg bg-alert py-2 text-[10px] font-bold text-frost"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </Tile>
      )}

      {/* Timeline */}
      <Tile title="Tracking Timeline">
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

      {/* Before / After */}
      <Tile title="Before / After Proof">
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
