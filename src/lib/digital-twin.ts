/**
 * Infrastructure Digital Twin Engine for Urbix AI
 */

export type AssetType =
  | "Road"
  | "Drain"
  | "Streetlight"
  | "Traffic signal"
  | "Water pipeline"
  | "Public building"
  | "Bridge"
  | "Footpath";

export type AssetStatus = "Healthy" | "Warning" | "At Risk" | "Critical";

export type AssetDependency = {
  targetAssetId: string;
  targetAssetName: string;
  relationshipType: "DRAINS_INTO" | "SUPPORTS_TRAFFIC_FOR" | "SUPPLIES_WATER_TO" | "STRUCTURAL_BASE_FOR";
  riskWeight: number; // 0.0 - 1.0
  evidence: string;
};

export type InfrastructureAsset = {
  id: string;
  name: string;
  type: AssetType;
  ward: string;
  latitude: number;
  longitude: number;
  ageYears: number;
  material: string;
  installDate: string;
  healthScore: number; // 0 - 100
  riskScore: number; // 0 - 100
  status: AssetStatus;
  lastRepairDate: string;
  repairCount: number;
  recentComplaintsCount: number;
  estimatedRepairCost: number;
  dependencies: AssetDependency[];
  rootCauseAnalysis?: {
    primaryCause: string;
    contributingAssets: string[];
    confidence: "High" | "Medium" | "Low";
    recommendation: string;
  };
};

/**
 * Calculates asset health score (0 - 100) based on age, repairs, complaints & material degradation
 */
export function calculateAssetHealth(
  ageYears: number,
  repairCount: number,
  complaintCount: number,
  type: AssetType
): { healthScore: number; riskScore: number; status: AssetStatus } {
  // Baseline health starts at 100
  let health = 100;

  // Age degradation factor
  const maxAge = type === "Road" ? 10 : type === "Drain" ? 15 : 20;
  const ageFactor = Math.min(1.0, ageYears / maxAge);
  health -= ageFactor * 30;

  // Repair frequency degradation (frequent repairs = lower structural integrity)
  health -= Math.min(30, repairCount * 7.5);

  // Recent complaints degradation
  health -= Math.min(35, complaintCount * 10);

  // Clamp health
  const healthScore = Math.max(5, Math.min(100, Math.round(health)));
  const riskScore = 100 - healthScore;

  let status: AssetStatus = "Healthy";
  if (healthScore < 40) status = "Critical";
  else if (healthScore < 60) status = "At Risk";
  else if (healthScore < 80) status = "Warning";

  return { healthScore, riskScore, status };
}

/**
 * Detect Root-Cause Intelligence patterns across interconnected assets
 */
export function analyzeRootCause(
  asset: InfrastructureAsset,
  allAssets: InfrastructureAsset[]
): InfrastructureAsset["rootCauseAnalysis"] | undefined {
  // Pattern 1: Recurring Potholes on Road due to adjacent clogged Drain
  if (asset.type === "Road" && asset.repairCount >= 2) {
    const adjacentDrain = allAssets.find(
      (a) =>
        a.type === "Drain" &&
        a.ward === asset.ward &&
        (a.status === "Critical" || a.status === "At Risk")
    );
    if (adjacentDrain) {
      return {
        primaryCause: `Inadequate subsurface drainage at adjacent asset ${adjacentDrain.name}.`,
        contributingAssets: [adjacentDrain.id],
        confidence: "High",
        recommendation: `Desilt & clear ${adjacentDrain.name} before repaving ${asset.name} to prevent repeat pavement failure.`,
      };
    }
  }

  // Pattern 2: Water leakage causing road surface collapse
  if (asset.type === "Road" && asset.recentComplaintsCount >= 3) {
    const pipeline = allAssets.find((a) => a.type === "Water pipeline" && a.ward === asset.ward);
    if (pipeline) {
      return {
        primaryCause: `Sub-base water saturation from ${pipeline.name} pressure leak.`,
        contributingAssets: [pipeline.id],
        confidence: "Medium",
        recommendation: `Inspect ${pipeline.name} joint seals prior to asphalt resurfacing.`,
      };
    }
  }

  return undefined;
}
