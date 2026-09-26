import type { ScoredPlace } from "@/lib/meeting/fairness";

const STOP = new Set(["cafe", "coffee", "the", "and", "restaurant", "hotel", "shop", "bar", "park", "near", "city", "bengaluru", "bangalore"]);

const photoCache = new Map<string, string | null>();
let photoQueue = Promise.resolve();

function enqueuePhoto<T>(job: () => Promise<T>) {
  const run = photoQueue.then(job, job);
  photoQueue = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 200)),
    () => new Promise((resolve) => setTimeout(resolve, 200)),
  );
  return run;
}

function phraseOf(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function distinctive(name: string) {
  return phraseOf(name).split(" ").filter((word) => word.length >= 4 && !STOP.has(word));
}

function titleFits(name: string, title: string) {
  const hay = title.toLowerCase();
  const phrase = phraseOf(name);
  if (phrase.length >= 4 && hay.includes(phrase)) return true;
  const words = distinctive(name);
  const hits = words.filter((word) => hay.includes(word));
  if (hits.length === 0) return false;
  if (words.length === 1) return words[0].length >= 5;
  return hits.length >= 2 || hits.some((word) => word.length >= 6);
}

function usablePhoto(value: string) {
  if (!value.startsWith("https://") || value.length > 1800) return false;
  try {
    const host = new URL(value).hostname;
    return !host.endsWith("fbsbx.com") && !host.endsWith("fbcdn.net");
  } catch {
    return false;
  }
}

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
    return source && usablePhoto(source) ? source : null;
  } catch {
    return null;
  }
}

async function sitePhoto(website: string) {
  const target = website.startsWith("http://") ? `https://${website.slice("http://".length)}` : website;
  if (!target.startsWith("https://")) return null;
  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "text/html", "User-Agent": "NearMe/0.1 (https://nearme-sand.vercel.app; place photos)" },
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 80_000);
    const match =
      html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const raw = match?.[1]?.replaceAll("&amp;", "&") ?? "";
    const source = raw.startsWith("http://") ? `https://${raw.slice("http://".length)}` : raw;
    return usablePhoto(source) ? source : null;
  } catch {
    return null;
  }
}

type ImageHit = { title?: string; image?: string };

async function listedPhoto(name: string, category: string) {
  const query = `${name} ${category}`.trim();
  const headers = {
    Accept: "text/html,application/json",
    "User-Agent": "Mozilla/5.0 (compatible; NearMe/0.1; +https://nearme-sand.vercel.app)",
  };
  const home = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!home.ok) return null;
  const html = await home.text();
  const token = html.match(/vqd=["']([^"']+)["']/)?.[1] || html.match(/vqd=([\d-]+)/)?.[1];
  if (!token) return null;
  const url = new URL("https://duckduckgo.com/i.js");
  url.searchParams.set("q", query);
  url.searchParams.set("vqd", token);
  url.searchParams.set("o", "json");
  url.searchParams.set("l", "us-en");
  url.searchParams.set("p", "1");
  const response = await fetch(url, {
    headers: { ...headers, Accept: "application/json", Referer: "https://duckduckgo.com/" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { results?: ImageHit[] };
  const matches = (body.results ?? []).filter((item) => item.title && item.image && titleFits(name, item.title) && usablePhoto(item.image));
  const photos = matches.filter((item) => !/logo|favicon/i.test(`${item.title} ${item.image}`));
  const pool = photos.length > 0 ? photos : matches;
  const stable = pool.find((item) => !item.image!.includes("GoogleAccessId"));
  return (stable ?? pool[0])?.image ?? null;
}

async function venuePhoto(place: ScoredPlace) {
  const key = place.name.toLowerCase();
  if (photoCache.has(key)) return photoCache.get(key) ?? null;
  try {
    const found = await enqueuePhoto(async () => {
      if (place.website) {
        const fromSite = await sitePhoto(place.website);
        if (fromSite) return fromSite;
      }
      return listedPhoto(place.name, place.category);
    });
    photoCache.set(key, found);
    return found;
  } catch {
    return null;
  }
}

async function withPhoto(place: ScoredPlace) {
  const image =
    (place.image && usablePhoto(place.image) ? place.image : null) ??
    (place.wikipedia ? await wikipediaThumb(place.wikipedia) : null) ??
    (await venuePhoto(place));
  const next = { ...place, image };
  delete next.wikipedia;
  delete next.website;
  return next;
}

export async function attachImages(places: ScoredPlace[]) {
  const results = new Array<ScoredPlace>(places.length);
  let cursor = 0;
  async function worker() {
    while (cursor < places.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await withPhoto(places[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, places.length) }, () => worker()));
  return results;
}
