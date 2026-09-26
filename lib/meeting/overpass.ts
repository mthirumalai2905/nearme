import type { PlaceCandidate } from "@/lib/meeting/fairness";

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function addressFrom(tags: Record<string, string>) {
  const line = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const city = tags["addr:city"];
  const address = [line, city].filter(Boolean).join(", ");
  return address || null;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function queryOverpass(query: string) {
  let lastStatus = 0;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "NearMe/0.1",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!response.ok) {
        lastStatus = response.status;
        continue;
      }
      return (await response.json()) as { elements?: OverpassElement[] };
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(lastStatus ? `places_unavailable ${lastStatus}` : "places_unavailable");
}

function elementPoint(element: OverpassElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center) return { latitude: element.center.lat, longitude: element.center.lon };
  return null;
}

export async function findPlaces(
  latitude: number,
  longitude: number,
  radius: number,
  tags: Array<[string, string]>,
  category: string,
) {
  const safeRadius = Math.max(400, Math.min(8000, Math.round(radius)));
  const clauses = tags
    .map(
      ([key, value]) =>
        `node["${key}"="${value}"](around:${safeRadius},${latitude},${longitude});way["${key}"="${value}"](around:${safeRadius},${latitude},${longitude});`,
    )
    .join("");
  const query = `[out:json][timeout:20];(${clauses});out center 40;`;
  const body = await queryOverpass(query);
  const seen = new Set<string>();
  const places: PlaceCandidate[] = [];

  for (const element of body.elements ?? []) {
    const tagsOnElement = element.tags ?? {};
    const name = tagsOnElement.name?.trim();
    const point = elementPoint(element);
    if (!name || !point) continue;
    const key = `${name.toLowerCase()}:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hours = tagsOnElement.opening_hours?.trim();
    places.push({
      id: `${element.type}/${element.id}`,
      name,
      latitude: point.latitude,
      longitude: point.longitude,
      category,
      address: addressFrom(tagsOnElement),
      hours: hours ? hours.slice(0, 80) : null,
    });
  }

  return places;
}
