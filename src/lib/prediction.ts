/**
 * Failure Prediction Engine & Cascade Risk Propagation for Urbix AI
 */

import { InfrastructureAsset } from "./digital-twin";

export type FailurePrediction = {
  assetId: string;
  assetName: string;
  assetType: string;
  failureProbability: number; // 0 - 100%
  riskWindowDays: string; // e.g. "14-28 days"
  confidence: "High" | "Medium" | "Low";
  contributingFactors: string[];
};

export type CascadePrediction = {
  primaryAssetId: string;
  primaryAssetName: string;
  cascadeRiskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cascadeChain: string[]; // e.g. ["D-17 Drain", "R-104 Road", "Traffic Zone 7"]
  estimatedDownstreamImpactCost: number;
  affectedCitizensEstimate: number;
  mitigationSteps: string[];
};

export type PredictionOutcomeRecord = {
  id: string;
  assetId: string;
  assetName: string;
  predictedProbability: number;
  predictedDate: string;
  actualOutcome: "FAILURE_OCCURRED" | "PREVENTATIVE_REPAIR_MADE" | "NO_FAILURE";
  verdict: "TRUE_POSITIVE" | "FALSE_POSITIVE" | "CALIBRATED_SUCCESS";
  notes: string;
};

/**
 * Predict future structural failure risk based on asset health, age, environmental exposure & complaint history
 */
export function predictAssetFailure(
  asset: InfrastructureAsset,
  weatherRiskMultiplier: number = 1.0
): FailurePrediction {
  let prob = (100 - asset.healthScore) * 0.75 + asset.recentComplaintsCount * 5;
  prob = Math.min(95, Math.max(10, Math.round(prob * weatherRiskMultiplier)));

  let riskWindowDays = "60–90 days";
  if (prob >= 80) riskWindowDays = "7–14 days";
  else if (prob >= 60) riskWindowDays = "15–30 days";
  else if (prob >= 40) riskWindowDays = "30–60 days";

  const contributingFactors: string[] = [
    `Asset age (${asset.ageYears} years, material: ${asset.material}).`,
    `Current structural health rating (${asset.healthScore}/100).`,
    `${asset.repairCount} historical repair interventions recorded.`,
  ];
  if (asset.recentComplaintsCount > 0) {
    contributingFactors.push(`${asset.recentComplaintsCount} citizen observations reported recently.`);
  }

  let confidence: "High" | "Medium" | "Low" = "High";
  if (asset.repairCount < 1) confidence = "Medium";

  return {
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type,
    failureProbability: prob,
    riskWindowDays,
    confidence,
    contributingFactors,
  };
}

/**
 * Calculate Downstream Cascading Risk Propagation across Infrastructure Dependency Graph
 */
export function predictCascadingFailure(
  triggerAsset: InfrastructureAsset,
  allAssets: InfrastructureAsset[]
): CascadePrediction {
  const chain: string[] = [triggerAsset.name];
  let impactCost = triggerAsset.estimatedRepairCost;
  let affectedCitizens = triggerAsset.recentComplaintsCount * 250 + 500;

  // Traversal of dependencies
  for (const dep of triggerAsset.dependencies) {
    const target = allAssets.find((a) => a.id === dep.targetAssetId);
    if (target) {
      chain.push(`${target.name} (${dep.relationshipType.replace("_", " ")})`);
      impactCost += target.estimatedRepairCost * dep.riskWeight;
      affectedCitizens += 1200;
    }
  }

  if (chain.length === 1) {
    chain.push(`Local Traffic Zone (${triggerAsset.ward})`);
  }

  let cascadeRiskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  if (triggerAsset.riskScore > 75 || chain.length >= 3) cascadeRiskLevel = "CRITICAL";
  else if (triggerAsset.riskScore > 55) cascadeRiskLevel = "HIGH";

  const mitigationSteps = [
    `Clear blockage/inspect structural joint on ${triggerAsset.name} immediately.`,
    `Pre-position field crew in ${triggerAsset.ward} prior to severe weather.`,
    `Notify traffic management department for temporary detour route if required.`,
  ];

  return {
    primaryAssetId: triggerAsset.id,
    primaryAssetName: triggerAsset.name,
    cascadeRiskLevel,
    cascadeChain: chain,
    estimatedDownstreamImpactCost: Math.round(impactCost * 1.8), // Includes downtime impact
    affectedCitizensEstimate: affectedCitizens,
    mitigationSteps,
  };
}
