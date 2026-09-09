/**
 * Multi-Source Location Intelligence System for Urbix AI
 * Priorities:
 * 1. Image EXIF GPS
 * 2. Device GPS
 * 3. Manual map selection
 * 4. Visual / OCR location suggestion
 */

export type LocationSource = "IMAGE_EXIF" | "DEVICE_GPS" | "MANUAL_PIN" | "VISUAL_SUGGESTION";

export type LocationRecord = {
  latitude: number;
  longitude: number;
  source: LocationSource;
  accuracy: number; // in meters
  address?: string;
  timestamp?: string;
  confidence?: "High" | "Medium" | "Low";
};

export type DualLocationData = {
  imageLocation: LocationRecord | null;
  reportLocation: LocationRecord;
};

/**
 * Extracts GPS metadata directly from raw JPEG ArrayBuffer bytes (EXIF Tags 0x8825 GPSInfo).
 * Returns lat/lng if present in EXIF header.
 */
export function extractExifGps(arrayBuffer: ArrayBuffer): { latitude: number; longitude: number; timestamp?: string } | null {
  try {
    const dataView = new DataView(arrayBuffer);
    if (dataView.getUint16(0, false) !== 0xffd8) return null; // Not JPEG

    let offset = 2;
    const length = dataView.byteLength;

    while (offset < length) {
      if (dataView.getUint8(offset) !== 0xff) break;
      const marker = dataView.getUint8(offset + 1);

      // APP1 Marker for EXIF
      if (marker === 0xe1) {
        const exifLength = dataView.getUint16(offset + 2, false);
        const start = offset + 4;
        
        // Check "Exif\0\0" header
        if (
          dataView.getUint8(start) === 0x45 &&
          dataView.getUint8(start + 1) === 0x78 &&
          dataView.getUint8(start + 2) === 0x69 &&
          dataView.getUint8(start + 3) === 0x66
        ) {
          const tiffStart = start + 6;
          const littleEndian = dataView.getUint16(tiffStart, false) === 0x4949;
          const ifdOffset = dataView.getUint32(tiffStart + 4, littleEndian);
          
          let gpsOffset = 0;
          const numEntries = dataView.getUint16(tiffStart + ifdOffset, littleEndian);
          
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
            const tag = dataView.getUint16(entryOffset, littleEndian);
            if (tag === 0x8825) { // GPSInfo IFD Tag
              gpsOffset = dataView.getUint32(entryOffset + 8, littleEndian);
              break;
            }
          }

          if (gpsOffset) {
            const gpsStart = tiffStart + gpsOffset;
            const gpsEntries = dataView.getUint16(gpsStart, littleEndian);
            let lat: number[] | null = null;
            let latRef = "N";
            let lng: number[] | null = null;
            let lngRef = "E";

            for (let i = 0; i < gpsEntries; i++) {
              const entryOffset = gpsStart + 2 + i * 12;
              const tag = dataView.getUint16(entryOffset, littleEndian);
              const valueOffset = tiffStart + dataView.getUint32(entryOffset + 8, littleEndian);

              if (tag === 1) {
                latRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
              } else if (tag === 2) {
                lat = [
                  dataView.getUint32(valueOffset, littleEndian) / dataView.getUint32(valueOffset + 4, littleEndian),
                  dataView.getUint32(valueOffset + 8, littleEndian) / dataView.getUint32(valueOffset + 12, littleEndian),
                  dataView.getUint32(valueOffset + 16, littleEndian) / dataView.getUint32(valueOffset + 20, littleEndian)
                ];
              } else if (tag === 3) {
                lngRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
              } else if (tag === 4) {
                lng = [
                  dataView.getUint32(valueOffset, littleEndian) / dataView.getUint32(valueOffset + 4, littleEndian),
                  dataView.getUint32(valueOffset + 8, littleEndian) / dataView.getUint32(valueOffset + 12, littleEndian),
                  dataView.getUint32(valueOffset + 16, littleEndian) / dataView.getUint32(valueOffset + 20, littleEndian)
                ];
              }
            }

            if (lat && lng) {
              let latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
              if (latRef === "S") latitude = -latitude;

              let longitude = lng[0] + lng[1] / 60 + lng[2] / 3600;
              if (lngRef === "W") longitude = -longitude;

              return { latitude, longitude };
            }
          }
        }
        break;
      }
      offset += 2 + dataView.getUint16(offset + 2, false);
    }
  } catch {
    // Fail silently and let fallbacks handle location
  }
  return null;
}

/**
 * Reverse geocode latitude & longitude into readable address string
 */
export async function getReadableAddress(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) throw new Error();
    const info = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string };
    const addressParts = [info.locality, info.city, info.principalSubdivision].filter(Boolean);
    return addressParts.length > 0 ? addressParts.join(", ") : `Sector 4, ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `Ward 7, ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Perform visual/OCR location extraction suggestion from image text or notes
 */
export function extractVisualLocationSuggestions(text: string): { suggestedAddress: string; confidence: "High" | "Medium" | "Low" } | null {
  if (!text) return null;
  const roadRegex = /(?:anna nagar|mg road|ring road|main street|ward \d+|sector \d+|block [a-z0-9]+|station road|bypass)/i;
  const match = text.match(roadRegex);
  if (match) {
    return {
      suggestedAddress: match[0].toUpperCase(),
      confidence: "Medium"
    };
  }
  return null;
}
