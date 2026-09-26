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

function starsFrom(tags: Record<string, string>) {
  const value = Number(tags.stars);
  if (!Number.isFinite(value) || value < 1 || value > 5) return null;
  return value;
}

function websiteFrom(tags: Record<string, string>) {
  const value = (tags.website || tags["contact:website"] || tags.url || "").trim();
  if (!value || value.length > 180) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return null;
}

function imageFrom(tags: Record<string, string>) {
  const direct = tags.image?.trim();
  if (direct?.startsWith("https://")) return direct;
  const commons = tags.wikimedia_commons?.replace(/^File:/i, "").trim();
  if (commons && !commons.toLowerCase().startsWith("category:")) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=640`;
  }
  return null;
}

export function wikipediaTitle(tags: Record<string, string>) {
  const value = tags.wikipedia?.trim();
  if (!value || !/^[a-z]{2,3}:[^:]{1,120}$/i.test(value)) return null;
  const [lang, title] = value.split(":");
  if (!lang || !title) return null;
  return { lang: lang.toLowerCase(), title };
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function queryOverpass(query: string) {
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
  const query = `[out:json][timeout:25];(${clauses});out center 80;`;
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
    const wiki = wikipediaTitle(tagsOnElement);
    places.push({
      id: `${element.type}/${element.id}`,
      name,
      latitude: point.latitude,
      longitude: point.longitude,
      category,
      address: addressFrom(tagsOnElement),
      hours: hours ? hours.slice(0, 80) : null,
      image: imageFrom(tagsOnElement),
      website: websiteFrom(tagsOnElement),
      wikipedia: wiki ? `${wiki.lang}:${wiki.title}` : null,
      stars: starsFrom(tagsOnElement),
    });
  }

  return places;
}
