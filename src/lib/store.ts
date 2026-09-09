/**
 * Urbix AI Hybrid Data Store & Demo State Manager
 */

import { InfrastructureAsset } from "./digital-twin";
import { MaintenanceIntervention } from "./optimizer";
import { FailurePrediction, CascadePrediction, PredictionOutcomeRecord } from "./prediction";

export type UserRole = "CITIZEN" | "FIELD_OFFICER" | "CONTRACTOR" | "AUTHORITY" | "ADMIN";

export type ContractorAccountability = {
  id: string;
  name: string;
  department: string;
  durability30dRate: number; // e.g. 92%
  durability90dRate: number; // e.g. 87%
  durability180dRate: number; // e.g. 82%
  repeatFailureRate: number; // e.g. 8%
  avgResolutionDays: number; // e.g. 2.4 days
  completedRepairsCount: number;
  ratingScore: number; // 0 - 5.0
};

export type WardAccountability = {
  wardName: string;
  totalAssets: number;
  healthyAssetsCount: number;
  criticalAssetsCount: number;
  resolutionSpeedHours: number;
  preventiveMaintenanceRatio: number;
  unresolvedReportsCount: number;
  overallHealthScore: number;
};

export type AIReviewQueueItem = {
  id: string;
  reportId: string;
  category: string;
  severity: string;
  confidenceScore: number;
  reason: string;
  photoUrl: string;
  address: string;
  createdAt: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CORRECTED";
};

export type SimulationScenario = {
  id: string;
  name: string;
  type: "PRE_MONSOON" | "PRE_FESTIVAL";
  parameters: {
    rainfallMm24h?: number;
    footfallIncreasePercent?: number;
    trafficIncreasePercent?: number;
  };
  highRiskZones: string[];
  affectedAssetIds: string[];
  recommendedActions: string[];
  createdAt: string;
};

// Seeded Digital Twin Assets
export const INITIAL_ASSETS: InfrastructureAsset[] = [
  {
    id: "asset_d17",
    name: "Drain D-17 (Anna Nagar Central Channel)",
    type: "Drain",
    ward: "Ward 07",
    latitude: 13.0837,
    longitude: 80.21,
    ageYears: 11,
    material: "Reinforced Concrete Box Culvert",
    installDate: "2015-06-12",
    healthScore: 42,
    riskScore: 58,
    status: "At Risk",
    lastRepairDate: "2024-03-10",
    repairCount: 3,
    recentComplaintsCount: 5,
    estimatedRepairCost: 85000,
    dependencies: [
      {
        targetAssetId: "asset_r104",
        targetAssetName: "Road R-104 (Anna Salai Segment)",
        relationshipType: "DRAINS_INTO",
        riskWeight: 0.85,
        evidence: "Overflows onto sub-base pavement during heavy rains.",
      },
    ],
  },
  {
    id: "asset_r104",
    name: "Road R-104 (Anna Salai Segment)",
    type: "Road",
    ward: "Ward 07",
    latitude: 13.0825,
    longitude: 80.2707,
    ageYears: 8,
    material: "Bituminous Concrete Asphalt",
    installDate: "2018-02-20",
    healthScore: 58,
    riskScore: 42,
    status: "Warning",
    lastRepairDate: "2024-08-15",
    repairCount: 4,
    recentComplaintsCount: 3,
    estimatedRepairCost: 140000,
    dependencies: [
      {
        targetAssetId: "asset_t03",
        targetAssetName: "Traffic Signal T-03 (Anna Flyover Junction)",
        relationshipType: "SUPPORTS_TRAFFIC_FOR",
        riskWeight: 0.7,
        evidence: "Pothole slowdown causes severe arterial gridlock.",
      },
    ],
  },
  {
    id: "asset_s21",
    name: "Streetlight S-21 (Sector 4 Main Corridor)",
    type: "Streetlight",
    ward: "Ward 07",
    latitude: 13.085,
    longitude: 80.215,
    ageYears: 4,
    material: "Galvanized Steel Pole + LED Luminaire",
    installDate: "2022-09-05",
    healthScore: 82,
    riskScore: 18,
    status: "Healthy",
    lastRepairDate: "2025-01-20",
    repairCount: 1,
    recentComplaintsCount: 1,
    estimatedRepairCost: 25000,
    dependencies: [],
  },
  {
    id: "asset_p09",
    name: "Water Pipeline P-09 (Feeder Trunk 3)",
    type: "Water pipeline",
    ward: "Ward 07",
    latitude: 13.081,
    longitude: 80.208,
    ageYears: 14,
    material: "Ductile Iron Pipe 400mm",
    installDate: "2012-04-18",
    healthScore: 35,
    riskScore: 65,
    status: "Critical",
    lastRepairDate: "2023-11-02",
    repairCount: 6,
    recentComplaintsCount: 4,
    estimatedRepairCost: 195000,
    dependencies: [
      {
        targetAssetId: "asset_r104",
        targetAssetName: "Road R-104 (Anna Salai Segment)",
        relationshipType: "STRUCTURAL_BASE_FOR",
        riskWeight: 0.9,
        evidence: "Underground joint leakage saturates pavement sub-grade.",
      },
    ],
  },
];

// Seeded Contractor Accountability Records
export const SEEDED_CONTRACTORS: ContractorAccountability[] = [
  {
    id: "cont_01",
    name: "Apex Infra Projects Ltd.",
    department: "Roads & Highways",
    durability30dRate: 94,
    durability90dRate: 88,
    durability180dRate: 83,
    repeatFailureRate: 7,
    avgResolutionDays: 2.1,
    completedRepairsCount: 42,
    ratingScore: 4.7,
  },
  {
    id: "cont_02",
    name: "Urban Flow Drainage Works",
    department: "Stormwater Drainage",
    durability30dRate: 81,
    durability90dRate: 74,
    durability180dRate: 68,
    repeatFailureRate: 18,
    avgResolutionDays: 3.8,
    completedRepairsCount: 29,
    ratingScore: 3.8,
  },
  {
    id: "cont_03",
    name: "Lumina Municipal Lighting Services",
    department: "Electrical & Public Works",
    durability30dRate: 98,
    durability90dRate: 95,
    durability180dRate: 92,
    repeatFailureRate: 3,
    avgResolutionDays: 1.4,
    completedRepairsCount: 68,
    ratingScore: 4.9,
  },
];

// Seeded Ward Accountability
export const SEEDED_WARDS: WardAccountability[] = [
  {
    wardName: "Ward 07 (Central Urban)",
    totalAssets: 48,
    healthyAssetsCount: 32,
    criticalAssetsCount: 4,
    resolutionSpeedHours: 18.5,
    preventiveMaintenanceRatio: 64,
    unresolvedReportsCount: 3,
    overallHealthScore: 78,
  },
  {
    wardName: "Ward 09 (North Industrial)",
    totalAssets: 52,
    healthyAssetsCount: 28,
    criticalAssetsCount: 9,
    resolutionSpeedHours: 34.2,
    preventiveMaintenanceRatio: 41,
    unresolvedReportsCount: 8,
    overallHealthScore: 61,
  },
];

// Seeded Prediction Outcome Tracking (Prediction vs Reality)
export const SEEDED_PREDICTION_OUTCOMES: PredictionOutcomeRecord[] = [
  {
    id: "pred_01",
    assetId: "asset_d17",
    assetName: "Drain D-17",
    predictedProbability: 78,
    predictedDate: "2026-08-15",
    actualOutcome: "PREVENTATIVE_REPAIR_MADE",
    verdict: "CALIBRATED_SUCCESS",
    notes: "Desilted 4 days prior to heavy rain event. Flood avoided.",
  },
  {
    id: "pred_02",
    assetId: "asset_r104",
    assetName: "Road R-104",
    predictedProbability: 73,
    predictedDate: "2026-08-01",
    actualOutcome: "FAILURE_OCCURRED",
    verdict: "TRUE_POSITIVE",
    notes: "Pothole formed at predicted sub-grade weakness spot.",
  },
];

// Store Helper Functions
const CURRENT_ROLE_KEY = "urbix_active_user_role";

export function getActiveRole(): UserRole {
  if (typeof window === "undefined") return "CITIZEN";
  return (localStorage.getItem(CURRENT_ROLE_KEY) as UserRole) || "CITIZEN";
}

export function setActiveRole(role: UserRole) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CURRENT_ROLE_KEY, role);
  }
}
