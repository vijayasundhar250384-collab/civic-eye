import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import {
  INITIAL_ASSETS,
  SEEDED_CONTRACTORS,
  SEEDED_WARDS,
  SEEDED_PREDICTION_OUTCOMES,
  type AIReviewQueueItem,
} from "@/lib/store";
import { predictAssetFailure, predictCascadingFailure } from "@/lib/prediction";
import { optimizeMaintenanceBudget, type OptimizationResult } from "@/lib/optimizer";
import { analyzeRootCause } from "@/lib/digital-twin";

export const Route = createFileRoute("/_authenticated/authority")({
  head: () => ({
    meta: [
      { title: "Authority Portal — Urbix AI" },
      {
        name: "description",
        content: "Infrastructure Digital Twin dashboard, failure prediction, cascading risk, budget-constrained optimizer, simulations, and contractor accountability.",
      },
    ],
  }),
  component: AuthorityPage,
});

function AuthorityPage() {
  const [tab, setTab] = useState<"TWIN" | "OPTIMIZER" | "SIMULATION" | "REVIEW" | "ACCOUNTABILITY">("TWIN");
  
  // Budget Optimizer State
  const [budgetInput, setBudgetInput] = useState("500000");
  const [optimizerResult, setOptimizerResult] = useState<OptimizationResult | null>(() =>
    optimizeMaintenanceBudget(INITIAL_ASSETS, 500000)
  );

  // Simulation State
  const [rainfall, setRainfall] = useState("150");
  const [simResults, setSimResults] = useState<any | null>(null);

  // AI Review Queue State
  const [reviewItems, setReviewItems] = useState<AIReviewQueueItem[]>([
    {
      id: "rev_01",
      reportId: "rep_901",
      category: "drainage",
      severity: "HIGH",
      confidenceScore: 54,
      reason: "Low lighting in image reduced AI classification confidence below 60%.",
      photoUrl: "",
      address: "Anna Salai Junction, Ward 07",
      createdAt: "2 hours ago",
      status: "PENDING",
    },
    {
      id: "rev_02",
      reportId: "rep_902",
      category: "road_damage",
      severity: "CRITICAL",
      confidenceScore: 58,
      reason: "Uncertain repair resolution — residual pavement cracking detected.",
      photoUrl: "",
      address: "Sector 4 Main Corridor, Ward 07",
      createdAt: "4 hours ago",
      status: "PENDING",
    },
  ]);

  function runOptimizer() {
    const val = Number(budgetInput) || 500000;
    const res = optimizeMaintenanceBudget(INITIAL_ASSETS, val);
    setOptimizerResult(res);
    toast.success("AI-Informed Budget Optimization Plan updated!");
  }

  function runPreMonsoonSimulation() {
    const rain = Number(rainfall) || 150;
    setTimeout(() => {
      setSimResults({
        rainfallMm: rain,
        highRiskZones: ["Ward 07 (Central Urban)", "Ward 09 (North Industrial)"],
        threatenedAssets: [
          { name: "Drain D-17", risk: "CRITICAL (94%)", capacityExceededBy: "38%" },
          { name: "Road R-104", risk: "HIGH (82%)", capacityExceededBy: "25%" },
        ],
        cascadeChains: ["D-17 Drain → R-104 Sub-Base → Anna Salai Traffic Gridlock"],
        recommendedActions: [
          "Pre-position 2 mobile pump crews at Drain D-17 culvert.",
          "Desilt Anna Nagar Central Channel within 48 hours.",
          "Issue high-water advisory for Ward 07 low-lying pavement zones.",
        ],
      });
      toast.success("Pre-Monsoon Simulation executed successfully.");
    }, 600);
  }

  function handleReviewAction(id: string, action: "ACCEPTED" | "REJECTED") {
    setReviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
    toast.success(`AI Review case #${id} marked as ${action}`);
  }

  return (
    <AppShell subtitle="Portal C · Authority &amp; Digital Twin Desk">
      {/* Header Banner */}
      <section className="tile-solid p-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-extrabold text-ink">Municipal Digital Twin</p>
          <p className="text-[9.5px] font-semibold text-muted-foreground">
            Infrastructure Asset Health &amp; Risk Intelligence
          </p>
        </div>
        <span className="font-mono text-[9px] font-extrabold bg-brand/10 text-brand px-2 py-1 rounded-md">
          PORTAL C
        </span>
      </section>

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1">
        {(
          [
            { id: "TWIN", label: "Digital Twin" },
            { id: "OPTIMIZER", label: "Optimizer" },
            { id: "SIMULATION", label: "Simulation" },
            { id: "REVIEW", label: "AI Review" },
            { id: "ACCOUNTABILITY", label: "Accountability" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg py-1.5 px-0.5 text-center text-[9px] font-extrabold ring-1 transition-all ${
              tab === t.id ? "bg-brand text-brand-foreground ring-brand" : "bg-frost/70 text-ink ring-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DIGITAL TWIN & ASSET HEALTH */}
      {tab === "TWIN" && (
        <div className="space-y-3">
          <Tile title="Infrastructure Digital Twin Assets">
            <div className="space-y-2">
              {INITIAL_ASSETS.map((asset) => {
                const failurePred = predictAssetFailure(asset);
                const cascadePred = predictCascadingFailure(asset, INITIAL_ASSETS);
                const rootCause = analyzeRootCause(asset, INITIAL_ASSETS);

                return (
                  <div key={asset.id} className="tile-solid p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-ink">{asset.name}</p>
                        <p className="text-[9.5px] text-muted-foreground">
                          {asset.type} · {asset.ward} · Age: {asset.ageYears}y ({asset.material})
                        </p>
                      </div>
                      <span
                        className={`font-mono text-[9px] font-extrabold px-2 py-1 rounded ${
                          asset.status === "Critical"
                            ? "bg-alert/15 text-alert"
                            : asset.status === "At Risk"
                              ? "bg-accent/15 text-accent"
                              : "bg-ok/15 text-ok"
                        }`}
                      >
                        HEALTH: {asset.healthScore}/100
                      </span>
                    </div>

                    {/* Failure Prediction Engine Output */}
                    <div className="grid grid-cols-2 gap-1.5 bg-frost/50 p-2 rounded-lg ring-1 ring-border">
                      <div>
                        <p className="text-[8.5px] font-semibold text-muted-foreground">Failure Probability</p>
                        <p className="font-mono text-[12px] font-bold text-alert">
                          {failurePred.failureProbability}% ({failurePred.riskWindowDays})
                        </p>
                      </div>
                      <div>
                        <p className="text-[8.5px] font-semibold text-muted-foreground">Cascading Risk Level</p>
                        <p className="font-mono text-[12px] font-bold text-brand">{cascadePred.cascadeRiskLevel}</p>
                      </div>
                    </div>

                    {/* Downstream Cascade Chain */}
                    <div className="text-[9px] font-medium text-muted-foreground">
                      <span className="font-bold text-ink">Cascade Chain: </span>
                      {cascadePred.cascadeChain.join(" → ")}
                    </div>

                    {/* Root-Cause Intelligence */}
                    {rootCause && (
                      <div className="bg-brand/8 p-2 rounded-lg ring-1 ring-brand/15 text-[9px]">
                        <p className="font-bold text-brand">Root-Cause Intelligence Diagnosis:</p>
                        <p className="text-ink font-semibold">{rootCause.primaryCause}</p>
                        <p className="text-muted-foreground mt-0.5">{rootCause.recommendation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Tile>
        </div>
      )}

      {/* TAB 2: BUDGET-CONSTRAINED MAINTENANCE OPTIMIZER */}
      {tab === "OPTIMIZER" && (
        <div className="space-y-3">
          <Tile title="AI-Informed Maintenance Budget Optimizer">
            <div className="space-y-2">
              <label className="block rounded-lg bg-frost/70 p-2.5 ring-1 ring-border">
                <span className="text-[9px] font-medium text-muted-foreground">Available Municipal Budget (₹)</span>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] font-extrabold text-ink outline-none"
                  />
                  <button
                    onClick={runOptimizer}
                    className="rounded-lg bg-brand px-3 py-1 text-[11px] font-bold text-brand-foreground"
                  >
                    Optimize Plan
                  </button>
                </div>
              </label>

              {optimizerResult && (
                <div className="space-y-3 pt-1">
                  {/* Headline Comparison Result */}
                  <div className="tile-solid p-3 bg-gradient-to-br from-brand/10 to-surface">
                    <p className="label-cap text-brand">Strategy Comparison Result</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-frost/80 p-2 rounded-lg ring-1 ring-border">
                        <p className="text-[9px] font-semibold text-muted-foreground">Reactive Baseline</p>
                        <p className="font-mono text-[14px] font-bold text-ink">
                          {optimizerResult.reactivePlan.totalRiskReduction} pts
                        </p>
                        <p className="text-[8.5px] text-muted-foreground">
                          {optimizerResult.reactivePlan.assetsRepairedCount} assets @ ₹
                          {optimizerResult.reactivePlan.totalCost.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-brand/15 p-2 rounded-lg ring-1 ring-brand/30">
                        <p className="text-[9px] font-extrabold text-brand">Urbix AI Optimized</p>
                        <p className="font-mono text-[14px] font-extrabold text-brand">
                          {optimizerResult.optimizedPlan.totalRiskReduction} pts
                        </p>
                        <p className="text-[8.5px] font-bold text-brand">
                          +{optimizerResult.improvementPercent}% Risk Reduction Improvement
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selected Interventions */}
                  <p className="label-cap">Selected Interventions (Knapsack Efficiency Ranked)</p>
                  <div className="space-y-1.5">
                    {optimizerResult.optimizedPlan.selectedInterventions.map((item, idx) => (
                      <div key={item.assetId} className="tile-solid p-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-ink">
                            #{idx + 1} {item.assetName}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {item.ward} · Risk Reduced: +{item.riskReductionScore} pts
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[11px] font-extrabold text-brand">
                            ₹{item.estimatedCost.toLocaleString()}
                          </p>
                          <span className="font-mono text-[8px] font-bold bg-ok/15 text-ok px-1.5 py-0.5 rounded">
                            SELECTED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Tile>
        </div>
      )}

      {/* TAB 3: PRE-MONSOON & PRE-FESTIVAL SIMULATIONS */}
      {tab === "SIMULATION" && (
        <div className="space-y-3">
          <Tile title="Municipal Stress Test &amp; Scenario Simulator">
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="block rounded-lg bg-frost/70 p-2 ring-1 ring-border">
                  <span className="text-[9px] font-medium text-muted-foreground">Rainfall Intensity (mm / 24h)</span>
                  <input
                    type="number"
                    value={rainfall}
                    onChange={(e) => setRainfall(e.target.value)}
                    className="w-full bg-transparent text-[12px] font-bold text-ink outline-none"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    onClick={runPreMonsoonSimulation}
                    className="w-full rounded-lg bg-brand py-2.5 text-[11px] font-bold text-brand-foreground"
                  >
                    Run Pre-Monsoon Simulation
                  </button>
                </div>
              </div>

              {simResults && (
                <div className="tile-solid p-3 space-y-2 bg-gradient-to-br from-brand/5 to-surface">
                  <div className="flex items-center justify-between">
                    <p className="label-cap text-alert">Simulation Output: {simResults.rainfallMm}mm Rainfall</p>
                    <span className="font-mono text-[8px] font-bold bg-alert/15 text-alert px-1.5 py-0.5 rounded">
                      SIMULATED SCENARIO
                    </span>
                  </div>

                  <div>
                    <p className="text-[9.5px] font-bold text-ink">Predicted High-Risk Zones:</p>
                    <div className="flex gap-1.5 mt-1">
                      {simResults.highRiskZones.map((zone: string) => (
                        <span key={zone} className="bg-alert/10 text-alert font-mono text-[8.5px] font-bold px-2 py-0.5 rounded">
                          {zone}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9.5px] font-bold text-ink">Cascading Risk Chain:</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{simResults.cascadeChains[0]}</p>
                  </div>

                  <div>
                    <p className="text-[9.5px] font-bold text-brand">Recommended Preventative Actions:</p>
                    <ul className="mt-1 space-y-0.5 text-[9px] text-muted-foreground">
                      {simResults.recommendedActions.map((act: string, i: number) => (
                        <li key={i}>• {act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </Tile>
        </div>
      )}

      {/* TAB 4: AI HUMAN-IN-THE-LOOP REVIEW QUEUE */}
      {tab === "REVIEW" && (
        <div className="space-y-3">
          <Tile title="AI Uncertainty &amp; Verification Review Queue">
            <div className="space-y-2">
              {reviewItems.map((item) => (
                <div key={item.id} className="tile-solid p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-bold text-ink">{item.address}</p>
                      <p className="text-[9px] text-muted-foreground">Category: {item.category} · {item.createdAt}</p>
                    </div>
                    <span
                      className={`font-mono text-[8.5px] font-bold px-2 py-0.5 rounded ${
                        item.status === "PENDING"
                          ? "bg-accent/15 text-accent"
                          : item.status === "ACCEPTED"
                            ? "bg-ok/15 text-ok"
                            : "bg-alert/15 text-alert"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="bg-frost/60 p-2 rounded-lg text-[9px]">
                    <p className="font-bold text-ink">Flag Reason:</p>
                    <p className="text-muted-foreground">{item.reason}</p>
                  </div>

                  {item.status === "PENDING" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleReviewAction(item.id, "REJECTED")}
                        className="rounded-lg bg-alert/10 py-1.5 text-[10px] font-bold text-alert ring-1 ring-alert/20"
                      >
                        Reject Classification
                      </button>
                      <button
                        onClick={() => handleReviewAction(item.id, "ACCEPTED")}
                        className="rounded-lg bg-brand py-1.5 text-[10px] font-bold text-brand-foreground"
                      >
                        Confirm &amp; Validate
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Tile>
        </div>
      )}

      {/* TAB 5: CONTRACTOR & WARD ACCOUNTABILITY */}
      {tab === "ACCOUNTABILITY" && (
        <div className="space-y-3">
          <Tile title="Contractor Repair Durability Matrix">
            <div className="space-y-2">
              {SEEDED_CONTRACTORS.map((c) => (
                <div key={c.id} className="tile-solid p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-bold text-ink">{c.name}</p>
                      <p className="text-[9px] text-muted-foreground">{c.department}</p>
                    </div>
                    <span className="font-mono text-[11px] font-extrabold text-ok">
                      ★ {c.ratingScore}/5.0
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                    <div className="bg-frost/70 p-1.5 rounded-lg ring-1 ring-border">
                      <p className="text-[8px] text-muted-foreground font-sans">30d Durability</p>
                      <p className="text-[11px] font-extrabold text-ok">{c.durability30dRate}%</p>
                    </div>
                    <div className="bg-frost/70 p-1.5 rounded-lg ring-1 ring-border">
                      <p className="text-[8px] text-muted-foreground font-sans">90d Durability</p>
                      <p className="text-[11px] font-extrabold text-brand">{c.durability90dRate}%</p>
                    </div>
                    <div className="bg-frost/70 p-1.5 rounded-lg ring-1 ring-border">
                      <p className="text-[8px] text-muted-foreground font-sans">Repeat Failure</p>
                      <p className="text-[11px] font-extrabold text-alert">{c.repeatFailureRate}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Tile>

          <Tile title="Prediction vs. Reality Calibration Tracker">
            <div className="space-y-1.5">
              {SEEDED_PREDICTION_OUTCOMES.map((rec) => (
                <div key={rec.id} className="tile-solid p-2.5 flex items-center justify-between text-[9px]">
                  <div>
                    <p className="font-bold text-ink">{rec.assetName} Prediction</p>
                    <p className="text-muted-foreground">{rec.notes}</p>
                  </div>
                  <span className="font-mono font-bold bg-ok/15 text-ok px-2 py-0.5 rounded">
                    {rec.verdict}
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        </div>
      )}
    </AppShell>
  );
}
