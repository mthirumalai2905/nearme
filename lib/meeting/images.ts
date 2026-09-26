import type { ScoredPlace } from "@/lib/meeting/fairness";

async function wikipediaThumb(spec: string) {
  const [lang, title] = spec.split(":");
  if (!lang || !title) return null;
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(2500), headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { thumbnail?: { source?: string } };
    const source = body.thumbnail?.source;
    return source?.startsWith("https://") ? source : null;
  } catch {
    return null;
  }
}

export async function attachImages(places: ScoredPlace[]) {
  return Promise.all(
    places.map(async (place) => {
      const image = place.image ?? (place.wikipedia ? await wikipediaThumb(place.wikipedia) : null);
      const next = { ...place, image };
      delete next.wikipedia;
      return next;
    }),
  );
}
