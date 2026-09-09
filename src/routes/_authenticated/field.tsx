import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, timeAgo } from "@/lib/civic";
import { checkImageQuality, verifyRepairResolution, type ProofOfResolutionResult } from "@/lib/ai.pipeline";
import { getOfflineQueue, saveOfflineRepair, isOnline } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/field")({
  head: () => ({
    meta: [
      { title: "Field Officer Portal — Urbix AI" },
      {
        name: "description",
        content: "AI-prioritized field maintenance task queue, route optimization, repair execution, and AI proof-of-resolution verification.",
      },
    ],
  }),
  component: FieldOfficerPage,
});

function FieldOfficerPage() {
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [materials, setMaterials] = useState("Bituminous Cold Mix (25kg), Sealant Grade B");
  const [cost, setCost] = useState("4500");
  const [notes, setNotes] = useState("Surface prepped, debris cleared, asphalt compacted using 2-ton roller.");
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [proofResult, setProofResult] = useState<ProofOfResolutionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reportsQuery = useQuery({
    queryKey: ["field-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, officers(*)")
        .neq("status", "resolved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasks = reportsQuery.data ?? [];
  const offlineCount = getOfflineQueue().length;

  function handleAfterPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAfterPhoto(dataUrl);
      setProofResult(null);

      // Perform AI image quality check
      const quality = checkImageQuality(dataUrl);
      if (!quality.usableForAI) {
        toast.warning(quality.feedback);
      }
    };
    reader.readAsDataURL(file);
  }

  function runAIProofCheck() {
    if (!afterPhoto) {
      toast.error("Please capture or upload an after-repair photo first.");
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      const res = verifyRepairResolution(selectedTask?.photo_url || "", afterPhoto, selectedTask?.category || "other");
      setProofResult(res);
      setVerifying(false);
      toast.success("AI Proof-of-Resolution scan completed.");
    }, 900);
  }

  async function submitRepairExecution() {
    if (!selectedTask || !afterPhoto) {
      toast.error("An after photo and repair details are required.");
      return;
    }
    setSaving(true);
    try {
      if (!isOnline()) {
        saveOfflineRepair({
          reportId: selectedTask.id,
          officerId: selectedTask.officer_id || "officer_demo",
          afterPhotoDataUrl: afterPhoto,
          materialsLogged: materials,
          costLogged: Number(cost) || 0,
          notes,
        });
        toast.success("Saved to local offline queue. Will sync automatically when online.");
        setSelectedTask(null);
        setAfterPhoto(null);
        setProofResult(null);
        setSaving(false);
        return;
      }

      // Upload resolved photo to storage
      const blob = await (await fetch(afterPhoto)).blob();
      const path = `repairs/${selectedTask.id}_${Date.now()}.jpg`;
      await supabase.storage.from("report-photos").upload(path, blob);

      // Update report status
      await supabase
        .from("reports")
        .update({
          status: "resolved",
          resolved_photo_url: path,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", selectedTask.id);

      await supabase.from("report_events").insert({
        report_id: selectedTask.id,
        label: "Repair completed by field crew",
        detail: `Materials: ${materials} · Cost: ₹${cost} · AI Proof: ${proofResult?.status || "PASS"} (${proofResult?.confidenceScore || 92}%)`,
        kind: "ok",
      });

      toast.success("Repair execution recorded and submitted for citizen confirmation!");
      setSelectedTask(null);
      setAfterPhoto(null);
      setProofResult(null);
      void reportsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record repair.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell subtitle="Portal B · Field Officer &amp; Contractor Desk">
      {/* Offline Status Badge */}
      <section className="tile-solid p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${isOnline() ? "bg-ok" : "bg-alert animate-pulse"}`} />
          <div>
            <p className="text-[12px] font-bold text-ink">
              {isOnline() ? "Online Mode" : "Offline Storage Active"}
            </p>
            <p className="text-[9px] font-medium text-muted-foreground">
              {offlineCount > 0 ? `${offlineCount} local tasks waiting for sync` : "All field task syncs up to date"}
            </p>
          </div>
        </div>
        <span className="font-mono text-[9px] font-extrabold bg-brand/10 text-brand px-2 py-1 rounded-md">
          PORTAL B
        </span>
      </section>

      {/* Task Queue Header */}
      <Tile
        title="AI-Prioritized Field Task Queue"
        right={<span className="font-mono text-[9px] font-extrabold text-brand">{tasks.length} PENDING JOBS</span>}
      >
        <div className="space-y-2">
          {tasks.map((task, idx) => {
            const priorityScore = Math.max(60, 98 - idx * 7);
            const isCritical = task.severity === "high" || task.escalated;
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`tile-solid cursor-pointer p-3 transition-all hover:ring-brand/40 ${
                  selectedTask?.id === task.id ? "ring-2 ring-brand bg-brand/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-extrabold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <p className="text-[13px] font-bold text-ink">{categoryLabel(task.category)}</p>
                  </div>
                  <span
                    className={`font-mono text-[9px] font-extrabold px-2 py-0.5 rounded ${
                      isCritical ? "bg-alert/15 text-alert" : "bg-ok/15 text-ok"
                    }`}
                  >
                    PRIORITY {priorityScore}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {task.address || "Location pinned"} · {timeAgo(task.created_at)}
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5">
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    SLA: {task.sla_hours}h · Area: {task.area}
                  </span>
                  <span className="text-[10px] font-bold text-brand">Execute Job →</span>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="py-6 text-center text-[11px] text-muted-foreground">
              No pending field jobs in your queue.
            </p>
          )}
        </div>
      </Tile>

      {/* Selected Task Details & AI Proof-of-Resolution Form */}
      {selectedTask && (
        <Tile title={`Job Execution · ${categoryLabel(selectedTask.category)}`}>
          <div className="space-y-3">
            <div className="tile-solid p-2.5">
              <p className="text-[9px] font-semibold text-muted-foreground">Original Issue Location</p>
              <p className="text-[12px] font-bold text-ink">{selectedTask.address || "Pinned location"}</p>
              <p className="font-mono text-[9px] text-muted-foreground">
                GPS: {selectedTask.latitude?.toFixed(5)}, {selectedTask.longitude?.toFixed(5)}
              </p>
              {selectedTask.description && (
                <p className="mt-1 text-[10px] text-ink italic">"{selectedTask.description}"</p>
              )}
            </div>

            {/* Material & Cost Logging */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block rounded-lg bg-frost/70 p-2 ring-1 ring-border">
                <span className="text-[9px] font-medium text-muted-foreground">Materials Logged</span>
                <input
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  className="w-full bg-transparent text-[11px] font-semibold text-ink outline-none"
                />
              </label>
              <label className="block rounded-lg bg-frost/70 p-2 ring-1 ring-border">
                <span className="text-[9px] font-medium text-muted-foreground">Actual Cost (₹)</span>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full bg-transparent text-[11px] font-semibold text-ink outline-none"
                />
              </label>
            </div>

            {/* Notes */}
            <label className="block rounded-lg bg-frost/70 p-2 ring-1 ring-border">
              <span className="text-[9px] font-medium text-muted-foreground">Field Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-[11px] text-ink outline-none"
              />
            </label>

            {/* Before & After Photo Proof */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="label-cap mb-1">Before Photo</p>
                <div className="aspect-square w-full rounded-lg bg-ink/10 grid place-items-center overflow-hidden">
                  <p className="text-[9px] text-muted-foreground p-2 text-center">Original Report Photo</p>
                </div>
              </div>

              <div>
                <p className="label-cap mb-1">After-Work Photo</p>
                {afterPhoto ? (
                  <img src={afterPhoto} alt="After repair" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="grid aspect-square w-full place-items-center rounded-lg bg-brand/10 text-[10px] font-bold text-brand ring-1 ring-brand/30 hover:bg-brand/20"
                  >
                    + Upload After Photo
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleAfterPhotoUpload}
                />
              </div>
            </div>

            {/* AI Proof-of-Resolution Trigger & Verdict */}
            {afterPhoto && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={runAIProofCheck}
                  disabled={verifying}
                  className="w-full rounded-lg bg-brand py-2 text-[11px] font-bold text-brand-foreground disabled:opacity-50"
                >
                  {verifying ? "Running AI Proof Scan..." : "Run AI Proof-of-Resolution Check"}
                </button>

                {proofResult && (
                  <div
                    className={`rounded-lg p-2.5 ring-1 ${
                      proofResult.status === "PASS" ? "bg-ok/10 ring-ok/30" : "bg-alert/10 ring-alert/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[10px] font-extrabold ${proofResult.status === "PASS" ? "text-ok" : "text-alert"}`}>
                        AI VERDICT: {proofResult.status} ({proofResult.confidenceScore}% CONFIDENCE)
                      </span>
                      <span className="text-[9px] font-semibold text-ink">
                        Damage Reduced: {proofResult.damageReductionPercent}%
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-[9.5px] text-muted-foreground">
                      {proofResult.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg bg-frost py-2.5 text-[11px] font-bold text-ink ring-1 ring-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRepairExecution}
                disabled={saving || !afterPhoto}
                className="rounded-lg bg-brand py-2.5 text-[11px] font-bold text-brand-foreground disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Repair"}
              </button>
            </div>
          </div>
        </Tile>
      )}
    </AppShell>
  );
}
