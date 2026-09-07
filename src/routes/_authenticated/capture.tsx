import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel, distanceMeters } from "@/lib/civic";
import { analyzePhoto, type AnalysisResult } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Camera capture — CivicLens" },
      {
        name: "description",
        content:
          "Capture a civic problem with the camera; the photo is geotagged, AI-verified and checked against nearby reports.",
      },
      { property: "og:title", content: "Camera capture — CivicLens" },
      {
        property: "og:description",
        content: "Geotagged camera capture with AI verification of civic problems.",
      },
    ],
  }),
  component: CapturePage,
});

type Fix = { lat: number; lng: number; accuracy: number; address: string; area: string };

function CapturePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; metres: number } | null>(null);
  const [category, setCategory] = useState<string>("pothole");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let address = "";
        let area = "urban";
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const info = (await res.json()) as {
            locality?: string;
            city?: string;
            principalSubdivision?: string;
􀀀          };
          address = [info.locality, info.city, info.principalSubdivision]
            .filter(Boolean)
            .join(", ");
          area = info.city ? "urban" : "rural";
        } catch {
          address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }
        setFix({ lat: latitude, lng: longitude, accuracy, address, area });
      },
      () => toast.error("Location is off. Turn on GPS so the report can be pinned."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Camera permission is needed to capture the problem.");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth || 1024, 1280);
    canvas.height = (canvas.width / (video.videoWidth || 4)) * (video.videoHeight || 3);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  }

  async function scan() {
    if (!shot || !fix) {
      toast.error("A photo and a GPS lock are both needed before scanning.");
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const { data: nearby } = await supabase
        .from("reports")
        .select("id, latitude, longitude, status")
        .neq("status", "resolved");
      const hit = (nearby ?? [])
        .map((r) => ({
          id: r.id,
          metres: distanceMeters(fix.lat, fix.lng, r.latitude, r.longitude),
        }))
        .filter((r) => r.metres < 40)
        .sort((a, b) => a.metres - b.metres)[0];
      setDuplicate(hit ?? null);

      const analysis = await analyzePhoto({
        data: {
          imageDataUrl: shot,
          latitude: fix.lat,
          longitude: fix.lng,
          locality: fix.address,
        },
      });
      setResult(analysis);
      setCategory(analysis.category);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    if (!shot || !fix || !result) return;
    if (duplicate) {
      toast.error("This spot is already reported. Open the existing report instead.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expired.");

      const blob = await (await fetch(shot)).blob();
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("report-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;

      const area = (result.area === "rural" || fix.area === "rural" ? "rural" : "urban") as
        | "rural"
        | "urban";

      const { data: officer } = await supabase
        .from("officers")
        .select("id")
        .eq("category", category as never)
        .eq("area", area)
        .maybeSingle();

      const { data: inserted, error } = await supabase
        .from("reports")
        .insert({
          user_id: uid,
          category: category as never,
          description,
          photo_url: path,
          latitude: fix.lat,
          longitude: fix.lng,
          address: fix.address,
          area,
          status: result.authentic ? "assigned" : "submitted",
          ai_verified: result.authentic,
          ai_confidence: result.confidence,
          ai_authenticity: result.authenticity,
          ai_duplicate_risk: 0,
          ai_notes: result.notes,
          severity: result.severity,
          officer_id: officer?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("report_events").insert([
        {
          report_id: inserted.id,
          label: "Report filed",
          detail: `AI verdict: ${result.authentic ? "original problem" : "needs manual review"} (${result.confidence}% confidence)`,
          kind: result.authentic ? "ok" : "warn",
        },
        {
          report_id: inserted.id,
          label: officer ? "Assigned to in-charge" : "Awaiting assignment",
          detail: officer
            ? "Routed to the department officer responsible for this ward."
            : "No officer mapped for this category yet.",
          kind: "info",
        },
      ]);

      toast.success("Report submitted to the in-charge officer.");
      navigate({ to: "/reports/$id", params: { id: inserted.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell subtitle="Camera capture" gpsReady={Boolean(fix)}>
      <div className="grid grid-cols-5 gap-3">
        <section className="tile col-span-3 p-2.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink">
            {shot ? (
              <img src={shot} alt="Captured civic problem" className="size-full object-cover" />
            ) : cameraOn ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-cover"
                aria-label="Live camera viewfinder"
              />
            ) : (
              <button
                onClick={startCamera}
                className="grid size-full place-items-center text-[10px] font-semibold tracking-[0.15em] text-frost/70 uppercase"
              >
                Tap to open camera
              </button>
            )}

            <span className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-frost/80" />
            <span className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-frost/80" />
            <span className="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-frost/80" />
            <span className="absolute right-2 bottom-2 size-4 border-r-2 border-b-2 border-frost/80" />

            {scanning && (
              <span className="animate-sweep absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-brand/40 to-transparent" />
            )}

            <span className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/50 px-2 py-0.5 font-mono text-[9px] font-semibold text-frost">
              <span className={`size-1.5 rounded-full ${fix ? "bg-ok" : "bg-accent"}`} />
              {fix ? `GPS LOCK ${fix.lat.toFixed(4)}` : "LOCATING…"}
            </span>

            {duplicate && (
              <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-alert/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-frost">
                <span className="size-1.5 rounded-full bg-frost" /> DUPLICATE{" "}
                {Math.round(duplicate.metres)}m
              </span>
            )}
            {scanning && (
              <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-brand/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-frost">
                <span className="size-1.5 animate-pulse rounded-full bg-frost" /> AI SCANNING
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {cameraOn ? (
              <button
                onClick={takePhoto}
                className="col-span-2 rounded-lg bg-brand py-2 text-[11px] font-semibold text-brand-foreground"
              >
                Capture photo
              </button>
            ) : shot ? (
              <>
                <button
                  onClick={() => {
                    setShot(null);
                    setResult(null);
                    setDuplicate(null);
                    void startCamera();
                  }}
                  className="rounded-lg bg-frost py-2 text-[11px] font-semibold text-ink ring-1 ring-border"
                >
                  Retake
                </button>
                <button
                  onClick={scan}
                  disabled={scanning}
                  className="rounded-lg bg-brand py-2 text-[11px] font-semibold text-brand-foreground disabled:opacity-60"
                >
                  {scanning ? "Scanning…" : "AI scan"}
                </button>
              </>
            ) : (
              <button
                onClick={startCamera}
                className="col-span-2 rounded-lg bg-brand py-2 text-[11px] font-semibold text-brand-foreground"
              >
                Open camera
              </button>
            )}
          </div>
        </section>

        <section className="tile col-span-2 flex flex-col p-3">
          <p className="label-cap">AI verdict</p>
          {result ? (
            <>
              <div
                className={`mt-1.5 rounded-lg p-2 ring-1 ${
                  result.authentic ? "bg-ok/10 ring-ok/20" : "bg-alert/10 ring-alert/20"
                }`}
              >
                <p
                  className={`font-mono text-[9px] font-semibold uppercase ${result.authentic ? "text-ok" : "text-alert"}`}
                >
                  {result.authentic ? "Verified · Original" : "Not verified"}
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-ink">
                  {categoryLabel(result.category)}
                </p>
                <p className="text-[9px] font-medium text-muted-foreground">
                  Confidence {result.confidence}%
                </p>
              </div>
              <div className="mt-2 space-y-1.5">
                <Meter label="Authenticity" value={result.authenticity} tone="bg-ok" />
                <Meter label="Confidence" value={result.confidence} tone="bg-brand" />
                <Meter
                  label="Duplicate risk"
                  value={duplicate ? 92 : 8}
                  tone="bg-accent"
                />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{result.notes}</p>
            </>
          ) : (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Capture a photo and run the AI scan. It checks whether the problem is real,
              names the category and rates how serious it is.
            </p>
          )}
        </section>
      </div>

      <Tile title="Problem details">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ring-1 ${
                category === c.value
                  ? "bg-brand text-brand-foreground ring-brand"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What exactly is wrong here?"
          className="mt-2 w-full rounded-lg bg-frost/70 p-2.5 text-[12px] text-ink ring-1 ring-border outline-none"
        />
        <div className="mt-2 rounded-lg bg-frost/70 p-2.5 ring-1 ring-border">
          <p className="text-[9px] font-medium text-muted-foreground">Location built in</p>
          <p className="text-[11px] font-semibold text-ink">
            {fix ? fix.address || "Pinned" : "Waiting for GPS…"}
          </p>
          {fix && (
            <p className="font-mono text-[9px] text-muted-foreground">
              {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · ±{Math.round(fix.accuracy)}m ·{" "}
              {fix.area === "rural" ? "Rural" : "Urban"}
            </p>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!result || saving || Boolean(duplicate)}
          className="mt-2 w-full rounded-lg bg-brand py-2.5 text-[12px] font-semibold text-brand-foreground disabled:opacity-50"
        >
          {duplicate
            ? "Already reported nearby"
            : saving
              ? "Submitting…"
              : "Submit to in-charge officer"}
        </button>
      </Tile>
    </AppShell>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[9px] font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
