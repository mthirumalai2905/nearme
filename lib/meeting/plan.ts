export type MeetPath = {
  name: string;
  minutes: number;
  meters: number;
  line: Array<[number, number]>;
};

export type MeetPlan = {
  place: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    image: string | null;
  };
  paths: MeetPath[];
};

function point(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const latitude = Number(value[0]);
  const longitude = Number(value[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

export function parseMeetPlan(value: unknown): MeetPlan | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { place?: unknown; paths?: unknown };
  const place = body.place as { id?: unknown; name?: unknown; latitude?: unknown; longitude?: unknown; image?: unknown } | undefined;
  if (!place || typeof place.id !== "string" || typeof place.name !== "string") return null;
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, 8) : [];
  const parsed: MeetPath[] = [];
  for (const path of paths) {
    if (!path || typeof path !== "object") continue;
    const item = path as { name?: unknown; minutes?: unknown; meters?: unknown; line?: unknown };
    if (typeof item.name !== "string" || !Array.isArray(item.line)) continue;
    const line = item.line.map(point).filter((entry): entry is [number, number] => Boolean(entry)).slice(0, 180);
    if (line.length < 2) continue;
    parsed.push({
      name: item.name.slice(0, 32),
      minutes: Math.max(1, Math.min(999, Math.round(Number(item.minutes) || 1))),
      meters: Math.max(0, Math.min(200000, Math.round(Number(item.meters) || 0))),
      line,
    });
  }
  return {
    place: {
      id: place.id.slice(0, 80),
      name: place.name.slice(0, 80),
      latitude,
      longitude,
      image: typeof place.image === "string" && place.image.startsWith("https://") ? place.image.slice(0, 400) : null,
    },
    paths: parsed,
  };
}
