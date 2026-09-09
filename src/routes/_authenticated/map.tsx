import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useRef, useState } from "react";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, distanceMeters, STATUS_LABEL } from "@/lib/civic";
import { INITIAL_ASSETS, type InfrastructureAsset } from "@/lib/store";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "3D City Infrastructure Digital Twin — Urbix AI" },
      {
        name: "description",
        content: "Geographic Leaflet & OpenStreetMap Digital Twin displaying real infrastructure assets, geotagged reports, asset health scores, and layer visibility controls.",
      },
    ],
  }),
  component: MapPage,
});

export function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof L | null>(null);

  const [activeLayer, setActiveLayer] = useState<"ALL" | "REPORTS" | "ASSETS">("ALL");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  // Center coordinate of Ward 07 Anna Salai / Sector 4 region
  const centerLat = 13.0827;
  const centerLng = 80.245;

  // Initialize Leaflet OpenStreetMap Container
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || mapInstanceRef.current) return;
    let isMounted = true;

    import("leaflet").then((leafletModule) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;
      const Leaflet = (leafletModule.default || leafletModule) as typeof L;
      leafletRef.current = Leaflet;

      const map = Leaflet.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: true,
      });

      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Urbix AI Digital Twin',
        maxZoom: 18,
      }).addTo(map);

      const layerGroup = Leaflet.layerGroup().addTo(map);
      markersGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
      setIsMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize Markers (Assets & Reports) onto Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    const Leaflet = leafletRef.current;
    if (!map || !group || !Leaflet || !isMapReady) return;

    group.clearLayers();

    // 1. Render Infrastructure Asset Markers (when layer is ALL or ASSETS)
    if (activeLayer === "ALL" || activeLayer === "ASSETS") {
      INITIAL_ASSETS.forEach((asset) => {
        let badgeBg = "#10b981"; // ok
        if (asset.status === "Critical") badgeBg = "#ef4444"; // alert
        else if (asset.status === "At Risk" || asset.status === "Warning") badgeBg = "#f59e0b"; // accent

        const assetHtml = `
          <div style="
            background: rgba(15, 23, 42, 0.9);
            color: #fff;
            border: 2px solid ${badgeBg};
            border-radius: 8px;
            padding: 3px 6px;
            font-size: 10px;
            font-weight: 800;
            font-family: monospace;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">
            🏗️ ${asset.name.split(" ")[0]} <span style="background:${badgeBg}; padding:1px 4px; border-radius:4px;">${asset.healthScore}</span>
          </div>
        `;

        const customIcon = Leaflet.divIcon({
          html: assetHtml,
          className: "",
          iconSize: [120, 26],
          iconAnchor: [60, 13],
        });

        const marker = Leaflet.marker([asset.latitude, asset.longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
            <strong style="font-size: 12px; color: #0f172a;">${asset.name}</strong><br/>
            <span>Type: <b>${asset.type}</b> · Ward: <b>${asset.ward}</b></span><br/>
            <span>Health Score: <b style="color: ${badgeBg};">${asset.healthScore}/100</b> (${asset.status})</span><br/>
            <span>Age: <b>${asset.ageYears} yrs</b> (${asset.material})</span>
          </div>
        `);

        marker.on("click", () => {
          setSelectedAssetId(asset.id);
          setSelectedReportId(null);
        });

        group.addLayer(marker);
      });
    }

    // 2. Render Citizen Report Markers (when layer is ALL or REPORTS)
    if (activeLayer === "ALL" || activeLayer === "REPORTS") {
      rows.forEach((report) => {
        const isResolved = report.status === "resolved";
        const isEscalated = Boolean(report.escalated);
        const pinBg = isResolved ? "#10b981" : isEscalated ? "#ef4444" : "#0e7490";

        const reportHtml = `
          <div style="
            background: ${pinBg};
            color: #ffffff;
            border: 2px solid #ffffff;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          ">
            📌
          </div>
        `;

        const customIcon = Leaflet.divIcon({
          html: reportHtml,
          className: "",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = Leaflet.marker([report.latitude, report.longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
            <strong style="font-size: 12px; color: #0f172a;">${categoryLabel(report.category)}</strong><br/>
            <span>${report.address || "Geotagged Location"}</span><br/>
            <span>Status: <b>${STATUS_LABEL[report.status]}</b></span>
          </div>
        `);

        marker.on("click", () => {
          setSelectedReportId(report.id);
          setSelectedAssetId(null);
        });

        group.addLayer(marker);
      });
    }
  }, [activeLayer, rows, isMapReady]);

  // Center & Focus map when asset or report is selected
  function focusAssetOnMap(asset: InfrastructureAsset) {
    setSelectedAssetId(asset.id);
    setSelectedReportId(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([asset.latitude, asset.longitude], 15, { animate: true });
    }
  }

  // Dynamic Geotagged Pins Counter
  const totalGeotaggedPins = useMemo(() => {
    let count = 0;
    if (activeLayer === "ALL" || activeLayer === "REPORTS") count += rows.length;
    if (activeLayer === "ALL" || activeLayer === "ASSETS") count += INITIAL_ASSETS.length;
    return count;
  }, [rows, activeLayer]);

  const activeReport = rows.find((r) => r.id === selectedReportId);
  const activeAsset = INITIAL_ASSETS.find((a) => a.id === selectedAssetId);

  return (
    <AppShell subtitle="Portal C · Geographic Digital Twin Map">
      {/* Map Layer Control Bar */}
      <section className="tile-solid p-2.5 flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-ink">Map Layer Controls</span>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveLayer("ALL")}
            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
              activeLayer === "ALL" ? "bg-brand text-brand-foreground shadow-sm" : "bg-frost text-ink"
            }`}
          >
            All Layers
          </button>
          <button
            onClick={() => setActiveLayer("ASSETS")}
            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
              activeLayer === "ASSETS" ? "bg-brand text-brand-foreground shadow-sm" : "bg-frost text-ink"
            }`}
          >
            Asset Twin ({INITIAL_ASSETS.length})
          </button>
          <button
            onClick={() => setActiveLayer("REPORTS")}
            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
              activeLayer === "REPORTS" ? "bg-brand text-brand-foreground shadow-sm" : "bg-frost text-ink"
            }`}
          >
            Reports ({rows.length})
          </button>
        </div>
      </section>

      {/* Main Geographic Digital Twin Map Container */}
      <Tile
        title="3D CITY INFRASTRUCTURE VIEW"
        right={<span className="font-mono text-[9px] font-extrabold text-brand">OPENSTREETMAP GEOGRAPHIC TWIN</span>}
      >
        <div className="relative aspect-[16/12] overflow-hidden rounded-xl bg-muted border border-border shadow-inner">
          <div ref={mapContainerRef} className="size-full z-10" />

          {/* Dynamic Geotagged Pins Counter Badge */}
          <span className="absolute right-2 bottom-2 z-20 rounded-md bg-ink/80 px-2 py-1 font-mono text-[9.5px] font-extrabold text-frost backdrop-blur-md border border-frost/20 shadow-lg">
            Geotagged Pins {totalGeotaggedPins}
          </span>
        </div>
      </Tile>

      {/* Asset Health Twin Interactive Selector List */}
      <Tile title="Asset Health Twin (Tap asset to center &amp; focus geographic map)">
        <div className="space-y-1.5">
          {INITIAL_ASSETS.map((asset) => (
            <div
              key={asset.id}
              onClick={() => focusAssetOnMap(asset)}
              className={`tile-solid cursor-pointer p-2.5 flex items-center justify-between text-[10px] transition-all ${
                selectedAssetId === asset.id ? "ring-2 ring-brand bg-brand/10 shadow-sm" : "hover:bg-frost/80"
              }`}
            >
              <div>
                <p className="font-extrabold text-ink">{asset.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {asset.ward} · {asset.type} · Risk Score: {asset.riskScore}/100
                </p>
              </div>
              <span
                className={`font-mono font-extrabold px-2 py-0.5 rounded ${
                  asset.status === "Critical"
                    ? "bg-alert/15 text-alert"
                    : asset.status === "At Risk" || asset.status === "Warning"
                      ? "bg-accent/15 text-accent"
                      : "bg-ok/15 text-ok"
                }`}
              >
                {asset.healthScore}/100
              </span>
            </div>
          ))}
        </div>
      </Tile>

      {/* Selected Map Entity Card */}
      <Tile title="Selected Geographic Entity Card">
        {activeAsset ? (
          <div className="tile-solid p-3 space-y-1">
            <p className="text-[13px] font-extrabold text-ink">{activeAsset.name}</p>
            <p className="text-[10px] text-muted-foreground">
              Type: {activeAsset.type} · Health: {activeAsset.healthScore}/100 · Risk: {activeAsset.status.toUpperCase()}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground">
              Geographic GPS: {activeAsset.latitude.toFixed(5)}, {activeAsset.longitude.toFixed(5)}
            </p>
            <div className="pt-1">
              <Link to="/authority" className="text-[10px] font-bold text-brand hover:underline">
                Open Asset Intelligence in Authority Portal →
              </Link>
            </div>
          </div>
        ) : activeReport ? (
          <Link to="/reports/$id" params={{ id: activeReport.id }} className="tile-solid block p-3">
            <p className="text-[13px] font-bold text-ink">{categoryLabel(activeReport.category)}</p>
            <p className="text-[10px] text-muted-foreground">
              {activeReport.address || "Pinned location"} · {STATUS_LABEL[activeReport.status]}
            </p>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              Geographic GPS: {activeReport.latitude.toFixed(5)}, {activeReport.longitude.toFixed(5)}
            </p>
          </Link>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Select an infrastructure asset or geotagged report marker on the map to view detailed spatial intelligence.
          </p>
        )}
      </Tile>
    </AppShell>
  );
}
