import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/civic";
import { analyzePhoto, type AnalysisResult } from "@/lib/ai.functions";
import {
  extractExifGps,
  getReadableAddress,
  type LocationSource,
  type LocationRecord,
} from "@/lib/location";
import {
  checkImageQuality,
  buildExplainableEvidence,
  calculateMultiFactorDuplicate,
  type ImageQualityReport,
  type ExplainableEvidence,
  type DuplicateMatch,
} from "@/lib/ai.pipeline";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Camera capture — Urbix AI" },
      {
        name: "description",
        content:
          "Capture a civic problem with camera or image upload; photo is geotagged via EXIF/GPS, AI-verified with explainable evidence.",
      },
    ],
  }),
  component: CapturePage,
});

function CapturePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [reportLocation, setReportLocation] = useState<LocationRecord | null>(null);
  const [imageLocation, setImageLocation] = useState<LocationRecord | null>(null);
  
  const [qualityReport, setQualityReport] = useState<ImageQualityReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [explainableEvidence, setExplainableEvidence] = useState<ExplainableEvidence | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);

  const [category, setCategory] = useState<string>("pothole");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualMapOpen, setManualMapOpen] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // Priority 2: Device GPS initialization
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const address = await getReadableAddress(latitude, longitude);
        setReportLocation((prev) =>
          prev && prev.source === "IMAGE_EXIF"
            ? prev
            : {
                latitude,
                longitude,
                source: "DEVICE_GPS",
                accuracy,
                address,
                confidence: "High",
              }
        );
      },
      () => {
        // Fallback to manual pin default
        setReportLocation({
          latitude: 13.0827,
          longitude: 80.2707,
          source: "MANUAL_PIN",
          accuracy: 50,
          address: "Sector 4 Main Corridor, Ward 07",
          confidence: "Medium",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
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
      toast.error("Camera permission needed. You can also upload a photo file with EXIF GPS.");
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setShot(dataUrl);
    stopCamera();

    // Check image quality immediately
    const quality = checkImageQuality(dataUrl);
    setQualityReport(quality);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check Priority 1: EXIF GPS from file ArrayBuffer
    try {
      const buffer = await file.arrayBuffer();
      const exif = extractExifGps(buffer);
      if (exif) {
        const address = await getReadableAddress(exif.latitude, exif.longitude);
        const exifLoc: LocationRecord = {
          latitude: exif.latitude,
          longitude: exif.longitude,
          source: "IMAGE_EXIF",
          accuracy: 5,
          address,
          confidence: "High",
        };
        setImageLocation(exifLoc);
        setReportLocation(exifLoc);
        toast.success("Image EXIF GPS extracted successfully!");
      }
    } catch {
      // Ignore EXIF failure and use Device GPS
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setShot(dataUrl);

      // Quality check
      const quality = checkImageQuality(dataUrl);
      setQualityReport(quality);
    };
    reader.readAsDataURL(file);
  }

  function setManualLocation(lat: number, lng: number, address: string) {
    const loc: LocationRecord = {
      latitude: lat,
      longitude: lng,
      source: "MANUAL_PIN",
      accuracy: 10,
      address,
      confidence: "High",
    };
    setReportLocation(loc);
    setManualMapOpen(false);
    toast.success("Manual location pin saved.");
  }

  async function runAIScan() {
    if (!shot || !reportLocation) {
      toast.error("A photo and location lock are both required before running AI scan.");
      return;
    }
    setScanning(true);
    setResult(null);
    setExplainableEvidence(null);
    setDuplicateMatch(null);

    try {
      // 1. Fetch nearby reports for Multi-Factor Duplicate Check
      const { data: nearby } = await supabase
        .from("reports")
        .select("id, latitude, longitude, category, description, created_at, status")
        .neq("status", "resolved");

      const dupMatch = calculateMultiFactorDuplicate(
        reportLocation.latitude,
        reportLocation.longitude,
        category,
        description,
        nearby ?? []
      );
      setDuplicateMatch(dupMatch);

      // 2. Call AI Vision service
      const analysis = await analyzePhoto({
        data: {
          imageDataUrl: shot,
          latitude: reportLocation.latitude,
          longitude: reportLocation.longitude,
          locality: reportLocation.address || "",
        },
      });
      setResult(analysis);
      setCategory(analysis.category);

      // 3. Build Explainable Evidence Diagnosis
      const quality = qualityReport || checkImageQuality(shot);
      const evidence = buildExplainableEvidence(
        analysis.category,
        analysis.severity,
        analysis.confidence,
        analysis.notes,
        quality
      );
      setExplainableEvidence(evidence);

      if (evidence.requiresHumanReview) {
        toast.warning("AI confidence low. Report will be routed to Authority Review Queue.");
      } else {
        toast.success("AI Evidence & Damage Assessment ready!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    if (!shot || !reportLocation || !result) return;
    if (duplicateMatch && duplicateMatch.recommendation === "DUPLICATE_FOUND") {
      toast.error("A high-confidence duplicate report already exists nearby.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || "demo_citizen_user";

      const blob = await (await fetch(shot)).blob();
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      await supabase.storage.from("report-photos").upload(path, blob, { contentType: "image/jpeg" });

      const { data: officer } = await supabase
        .from("officers")
        .select("id")
        .eq("category", category as never)
        .maybeSingle();

      const { data: inserted, error } = await supabase
        .from("reports")
        .insert({
          user_id: uid,
          category: category as never,
          description,
          photo_url: path,
          latitude: reportLocation.latitude,
          longitude: reportLocation.longitude,
          address: reportLocation.address || `${reportLocation.latitude.toFixed(4)}, ${reportLocation.longitude.toFixed(4)}`,
          area: "urban",
          status: result.authentic ? "assigned" : "submitted",
          ai_verified: result.authentic,
          ai_confidence: result.confidence,
          ai_authenticity: result.authenticity,
          ai_duplicate_risk: duplicateMatch ? duplicateMatch.similarityScore : 0,
          ai_notes: explainableEvidence?.evidenceBullets.join(" ") || result.notes,
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
          detail: `Location Source: ${reportLocation.source} · AI Verdict: ${result.authentic ? "Verified Original" : "Needs Review"} (${result.confidence}% confidence)`,
          kind: result.authentic ? "ok" : "warn",
        },
      ]);

      toast.success("Civic report submitted with verified location intelligence!");
      navigate({ to: "/reports/$id", params: { id: inserted.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell subtitle="Portal A · Multi-Source Geotagged Capture" gpsReady={Boolean(reportLocation)}>
      <div className="grid grid-cols-5 gap-3">
        {/* Camera / Image Upload Box */}
        <section className="tile col-span-3 p-2.5 space-y-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink">
            {shot ? (
              <img src={shot} alt="Captured civic problem" className="size-full object-cover" />
            ) : cameraOn ? (
              <video ref={videoRef} playsInline muted className="size-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center size-full gap-2 p-2">
                <button
                  onClick={startCamera}
                  className="rounded-lg bg-brand px-3 py-2 text-[11px] font-bold text-brand-foreground"
                >
                  Open Live Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-semibold text-frost/80 hover:text-frost"
                >
                  or Upload Image (EXIF GPS)
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Location Source Tag */}
            <span className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 font-mono text-[8.5px] font-bold text-frost border border-frost/20">
              <span className="size-1.5 rounded-full bg-ok" />
              {reportLocation?.source || "LOCATING..."}
            </span>

            {/* Duplicate Risk Tag */}
            {duplicateMatch && duplicateMatch.recommendation === "DUPLICATE_FOUND" && (
              <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-alert/90 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-frost">
                DUPLICATE ({duplicateMatch.similarityScore}% MATCH)
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-1.5">
            {shot ? (
              <>
                <button
                  onClick={() => {
                    setShot(null);
                    setResult(null);
                    setExplainableEvidence(null);
                  }}
                  className="rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border"
                >
                  Retake
                </button>
                <button
                  onClick={runAIScan}
                  disabled={scanning}
                  className="rounded-lg bg-brand py-2 text-[10px] font-bold text-brand-foreground disabled:opacity-60"
                >
                  {scanning ? "AI Scanning..." : "Run AI Scan"}
                </button>
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="col-span-2 rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border"
              >
                Upload File (Extract EXIF)
              </button>
            )}
          </div>
        </section>

        {/* AI Explainable Verdict & Evidence */}
        <section className="tile col-span-2 flex flex-col p-3">
          <p className="label-cap">AI Explainable Evidence</p>
          {explainableEvidence ? (
            <div className="mt-1.5 space-y-2">
              <div
                className={`rounded-lg p-2 ring-1 ${
                  explainableEvidence.severity === "HIGH" || explainableEvidence.severity === "CRITICAL"
                    ? "bg-alert/10 ring-alert/20"
                    : "bg-ok/10 ring-ok/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8.5px] font-extrabold text-brand uppercase">
                    CONFIDENCE: {explainableEvidence.confidenceRating}
                  </span>
                  <span className="font-mono text-[8.5px] font-extrabold text-alert uppercase">
                    {explainableEvidence.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] font-extrabold text-ink">
                  {explainableEvidence.detectedItem}
                </p>
              </div>

              {/* Evidence Bullets */}
              <div className="space-y-1">
                <p className="text-[8.5px] font-bold text-muted-foreground uppercase">Observed Evidence:</p>
                <ul className="space-y-0.5 text-[9.5px] text-ink font-medium">
                  {explainableEvidence.evidenceBullets.map((bullet, i) => (
                    <li key={i}>• {bullet}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded bg-brand/8 p-1.5 text-[9px] font-semibold text-brand">
                {explainableEvidence.recommendation}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Capture or upload a photo to run the modular AI explainable evidence pipeline.
            </p>
          )}
        </section>
      </div>

      {/* Location Provenance & Manual Fallback */}
      <Tile
        title="Location Provenance &amp; Verification"
        right={
          <button
            onClick={() => setManualMapOpen(!manualMapOpen)}
            className="text-[9.5px] font-bold text-brand"
          >
            {manualMapOpen ? "Close Pin Map" : "Select Pin Manually"}
          </button>
        }
      >
        <div className="space-y-2">
          {reportLocation ? (
            <div className="rounded-lg bg-frost/70 p-2.5 ring-1 ring-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                  SOURCE: {reportLocation.source}
                </span>
                <span className="text-[9px] font-medium text-muted-foreground">
                  Accuracy: ±{Math.round(reportLocation.accuracy)}m
                </span>
              </div>
              <p className="text-[11px] font-bold text-ink">{reportLocation.address}</p>
              <p className="font-mono text-[9px] text-muted-foreground">
                {reportLocation.latitude.toFixed(5)}, {reportLocation.longitude.toFixed(5)}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Detecting multi-source location...</p>
          )}

          {/* Manual Pin Selector Fallback */}
          {manualMapOpen && (
            <div className="tile-solid p-3 space-y-2">
              <p className="label-cap text-brand">Interactive Manual Location Pin</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualLocation(13.0827, 80.2707, "Anna Salai Junction, Ward 07")}
                  className="rounded-lg bg-frost p-2 text-left text-[10px] font-semibold text-ink ring-1 ring-border"
                >
                  📌 Anna Salai (Ward 07)
                </button>
                <button
                  type="button"
                  onClick={() => setManualLocation(13.085, 80.215, "Sector 4 Main Corridor, Ward 07")}
                  className="rounded-lg bg-frost p-2 text-left text-[10px] font-semibold text-ink ring-1 ring-border"
                >
                  📌 Sector 4 Corridor (Ward 07)
                </button>
              </div>
            </div>
          )}
        </div>
      </Tile>

      {/* Category & Details Form */}
      <Tile title="Problem Details &amp; Submission">
        <div className="space-y-2">
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
            placeholder="Describe the problem details..."
            className="w-full rounded-lg bg-frost/70 p-2.5 text-[12px] text-ink ring-1 ring-border outline-none"
          />

          <button
            onClick={submit}
            disabled={!result || saving || Boolean(duplicateMatch?.recommendation === "DUPLICATE_FOUND")}
            className="w-full rounded-lg bg-brand py-2.5 text-[12px] font-extrabold text-brand-foreground disabled:opacity-50"
          >
            {duplicateMatch?.recommendation === "DUPLICATE_FOUND"
              ? "Duplicate Problem Found Nearby"
              : saving
                ? "Submitting Report..."
                : "Submit Report to Field &amp; Intelligence Pipeline"}
          </button>
        </div>
      </Tile>
    </AppShell>
  );
}
