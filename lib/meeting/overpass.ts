import { calculateDistance } from "@/lib/distance/haversine";
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
        signal: AbortSignal.timeout(8000),
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
  const query = `[out:json][timeout:8];(${clauses});out center 40;`;
  const photonTask = photonPlaces(latitude, longitude, safeRadius, tags, category).catch(() => [] as PlaceCandidate[]);
  let overpassFailed = false;
  let body: { elements?: OverpassElement[] } = { elements: [] };
  try {
    body = await queryOverpass(query);
  } catch {
    overpassFailed = true;
  }
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

  if (places.length < 10) {
    for (const place of await photonTask) {
      if (places.length >= 20) break;
      const key = `${place.name.toLowerCase()}:${place.latitude.toFixed(4)}:${place.longitude.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
  }
  if (places.length > 0) return places;
  if (overpassFailed) throw new Error("places_unavailable");
  return places;
}

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
  };
};

async function photonPlaces(
  latitude: number,
  longitude: number,
  radius: number,
  tags: Array<[string, string]>,
  category: string,
) {
  const reach = Math.max(radius, 6000);
  const seen = new Set<string>();
  const places: PlaceCandidate[] = [];
  const headers = { Accept: "application/json", "User-Agent": "NearMe/0.1 (https://nearme-sand.vercel.app)" };
  for (const [key, value] of tags.slice(0, 3)) {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", value.replaceAll("_", " "));
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("limit", "20");
    url.searchParams.set("osm_tag", `${key}:${value}`);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) continue;
    const body = (await response.json()) as { features?: PhotonFeature[] };
    for (const feature of body.features ?? []) {
      const name = feature.properties?.name?.trim();
      const coords = feature.geometry?.coordinates;
      if (!name || !coords || coords.length < 2) continue;
      const pointLongitude = Number(coords[0]);
      const pointLatitude = Number(coords[1]);
      if (!Number.isFinite(pointLatitude) || !Number.isFinite(pointLongitude)) continue;
      if (calculateDistance(latitude, longitude, pointLatitude, pointLongitude) > reach) continue;
      const id = `${name.toLowerCase()}:${pointLatitude.toFixed(4)}:${pointLongitude.toFixed(4)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const kind = feature.properties?.osm_type === "W" ? "way" : feature.properties?.osm_type === "R" ? "relation" : "node";
      const address = [feature.properties?.housenumber, feature.properties?.street, feature.properties?.city].filter(Boolean).join(", ");
      places.push({
        id: `${kind}/${feature.properties?.osm_id ?? id}`,
        name,
        latitude: pointLatitude,
        longitude: pointLongitude,
        category,
        address: address || null,
        hours: null,
        image: null,
        website: null,
        stars: null,
      });
    }
  }
  return places;
}
