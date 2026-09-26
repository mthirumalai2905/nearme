import { NextResponse } from "next/server";
import { geographicCenter, maxPairwiseDistance } from "@/lib/distance/haversine";
import { maybeRewriteReasons } from "@/lib/meeting/explain";
import { attachImages } from "@/lib/meeting/images";
import { interpretPrompt } from "@/lib/meeting/prompt";
import { rankPlaces, searchRadiusMeters } from "@/lib/meeting/fairness";
import { findPlaces } from "@/lib/meeting/overpass";

type IncomingPerson = {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export async function POST(request: Request) {
  let payload: { prompt?: unknown; activity?: unknown; other?: unknown; people?: unknown; stars?: unknown; budget?: unknown };
  try {
    payload = (await request.json()) as { prompt?: unknown; activity?: unknown; other?: unknown; people?: unknown; stars?: unknown; budget?: unknown };
  } catch {
    return NextResponse.json({ message: "We couldn't look up places just now. Try again in a moment." }, { status: 400 });
  }

  const prompt = String(payload.prompt ?? payload.other ?? payload.activity ?? "");
  const starsValue = Number(payload.stars);
  const budgetValue = Number(payload.budget);
  const prefs = {
    stars: Number.isFinite(starsValue) && starsValue >= 1 && starsValue <= 5 ? starsValue : null,
    budget: Number.isFinite(budgetValue) && budgetValue > 0 && budgetValue < 1_000_000 ? Math.round(budgetValue) : null,
  };
  const activity = await interpretPrompt(prompt);
  const people = Array.isArray(payload.people) ? payload.people : [];
  if (!activity || people.length < 1 || people.length > 20) {
    return NextResponse.json(
      { message: "Share your location before looking for a place." },
      { status: 400 },
    );
  }

  const points = people.flatMap((person: IncomingPerson) => {
    const latitude = Number(person.latitude);
    const longitude = Number(person.longitude);
    const name = typeof person.name === "string" ? person.name.trim().slice(0, 32) : "";
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{ name, latitude, longitude }];
  });

  if (points.length < 1) {
    return NextResponse.json(
      { message: "Share your location before looking for a place." },
      { status: 400 },
    );
  }

  const center = geographicCenter(points);
  if (!center) {
    return NextResponse.json({ message: "We couldn't look up places just now. Try again in a moment." }, { status: 400 });
  }

  const spread = maxPairwiseDistance(points);
  const radius = searchRadiusMeters(spread);

  try {
    let candidates = await findPlaces(center.latitude, center.longitude, radius, activity.tags, activity.label);
    if (candidates.length === 0 && radius < 8000) {
      candidates = await findPlaces(
        center.latitude,
        center.longitude,
        Math.min(8000, Math.round(radius * 1.8)),
        activity.tags,
        activity.label,
      );
    }
    const ranked = rankPlaces(points, candidates, activity.label, prefs.stars);
    const reasoned = await maybeRewriteReasons(activity.label, [...ranked.places], prefs);
    const places = await attachImages(reasoned);
    return NextResponse.json({ mode: ranked.mode, places });
  } catch (error) {
    console.error("places lookup failed", error);
    return NextResponse.json(
      { message: "We couldn't look up places just now. Try again in a moment." },
      { status: 502 },
    );
  }
}
