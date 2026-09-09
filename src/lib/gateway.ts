/**
 * SMS / USSD / IVR Gateway Input Adapter for Urbix AI
 */

export type GatewayInputType = "SMS" | "USSD" | "IVR";

export type NormalizedGatewayReport = {
  sourceType: GatewayInputType;
  rawPayload: string;
  senderPhone?: string;
  category: string;
  locality: string;
  description: string;
  confidence: "High" | "Medium" | "Low";
  parsedAt: string;
};

/**
 * Normalizes unstructured text/voice payload into Urbix report format
 * Example SMS input: "REPORT POTHOLE ANNA NAGAR LARGE HOLE NEAR BUS STOP"
 * Example USSD input: "*384*1*7# -> Category: Drainage, Location: Ward 7"
 */
export function normalizeGatewayInput(
  rawInput: string,
  type: GatewayInputType = "SMS",
  phone: string = "+91 98765 43210"
): NormalizedGatewayReport {
  const text = rawInput.trim();
  let category = "other";
  let locality = "Ward 07";
  let description = text;

  const lower = text.toLowerCase();
  if (lower.includes("pothole") || lower.includes("hole") || lower.includes("pit")) category = "pothole";
  else if (lower.includes("drain") || lower.includes("waterlog") || lower.includes("sewage")) category = "drainage";
  else if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark")) category = "streetlight";
  else if (lower.includes("garbage") || lower.includes("waste") || lower.includes("trash")) category = "garbage";
  else if (lower.includes("water") || lower.includes("leak") || lower.includes("pipe")) category = "water_supply";
  else if (lower.includes("road") || lower.includes("crack")) category = "road_damage";

  // Locality extraction heuristic
  const locMatch = text.match(/(?:near|at|in|area)\s+([a-zA-Z0-9\s]{3,20})/i);
  if (locMatch) {
    locality = locMatch[1].trim();
  }

  return {
    sourceType: type,
    rawPayload: text,
    senderPhone: phone,
    category,
    locality,
    description: `[${type} Gateway Report] ${description}`,
    confidence: "Medium",
    parsedAt: new Date().toISOString(),
  };
}
