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
  verified: "Verified",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  escalated: "Escalated",
};

export function statusTone(status: string) {
  if (status === "resolved") return "ok";
  if (status === "escalated" || status === "rejected") return "alert";
  if (status === "in_progress" || status === "assigned") return "accent";
  return "brand";
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
