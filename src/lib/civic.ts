export const CATEGORIES = [
  { value: "pothole", label: "Pothole" },
  { value: "drainage", label: "Drainage" },
  { value: "streetlight", label: "Street light" },
  { value: "garbage", label: "Garbage" },
  { value: "water_supply", label: "Water supply" },
  { value: "road_damage", label: "Road damage" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  reported: "Reported",
  ai_verified: "AI Verified",
  verified: "Verified",
  assigned: "Assigned",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  repair_completed: "Repair Completed",
  citizen_confirmation: "Awaiting Citizen Confirmation",
  resolved: "Resolved",
  rejected: "Rejected",
  escalated: "Escalated",
  disputed: "Disputed / Under Review",
};

export function statusTone(status: string) {
  if (status === "resolved") return "ok";
  if (status === "escalated" || status === "rejected" || status === "disputed") return "alert";
  if (status === "in_progress" || status === "assigned" || status === "repair_completed") return "accent";
  return "brand";
}

/** Generate a realistic, unique report tracking ID (e.g. URB-2026-00421) */
export function generateReportId(indexSeed?: number): string {
  const num = indexSeed ? String(indexSeed).padStart(5, "0") : String(Math.floor(10000 + Math.random() * 90000));
  return `URB-2026-${num}`;
}

export type AuthorityContact = {
  department: string;
  divisionName: string;
  officerName: string;
  designation: string;
  phone: string;
  email: string;
  ward: string;
};

/** Authority Department Mapping based on category + ward */
export function getAuthorityDepartment(category: string, ward: string = "Ward 07"): AuthorityContact {
  if (category === "pothole" || category === "road_damage") {
    return {
      department: "Roads & Highways Division",
      divisionName: "Pavement & Asphalt Maintenance Cell",
      officerName: "Er. Vikram Singh (DEMO CONTACT)",
      designation: "Executive Engineer (Roads)",
      phone: "+91 98401 23456",
      email: "roads.ward7@urbix.gov.in (DEMO EMAIL)",
      ward,
    };
  }
  if (category === "drainage") {
    return {
      department: "Storm Water Drain Division",
      divisionName: "Hydraulic Channels & Desilting Wing",
      officerName: "Er. K. Ramesh (DEMO CONTACT)",
      designation: "Assistant Executive Engineer (Drainage)",
      phone: "+91 98402 34567",
      email: "drainage.ward7@urbix.gov.in (DEMO EMAIL)",
      ward,
    };
  }
  if (category === "streetlight") {
    return {
      department: "Electrical Maintenance Division",
      divisionName: "Public Lighting & Luminaire Ops",
      officerName: "Er. S. Meena (DEMO CONTACT)",
      designation: "Divisional Electrical Engineer",
      phone: "+91 98403 45678",
      email: "electrical.ward7@urbix.gov.in (DEMO EMAIL)",
      ward,
    };
  }
  if (category === "garbage") {
    return {
      department: "Sanitation & Solid Waste Division",
      divisionName: "Urban Sanitation Taskforce",
      officerName: "Officer R. Kumar (DEMO CONTACT)",
      designation: "Chief Sanitary Inspector",
      phone: "+91 98404 56789",
      email: "sanitation.ward7@urbix.gov.in (DEMO EMAIL)",
      ward,
    };
  }
  if (category === "water_supply") {
    return {
      department: "Metro Water Works Division",
      divisionName: "Trunk Pipelines & Pressure Supply Cell",
      officerName: "Er. P. Sundaram (DEMO CONTACT)",
      designation: "Superintending Water Engineer",
      phone: "+91 98405 67890",
      email: "water.ward7@urbix.gov.in (DEMO EMAIL)",
      ward,
    };
  }
  return {
    department: "Public Works Division",
    divisionName: "Municipal Maintenance Wing",
    officerName: "Er. A. Sharma (DEMO CONTACT)",
    designation: "Junior Engineer (Public Infrastructure)",
    phone: "+91 98406 78901",
    email: "pwd.ward7@urbix.gov.in (DEMO EMAIL)",
    ward,
  };
}

/** Metres between two lat/lng pairs (haversine). */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export function timeAgo(iso: string) {
  const h = hoursSince(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const USERNAME_DOMAIN = "civiclens.app";

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${USERNAME_DOMAIN}`;
}
