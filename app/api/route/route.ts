import { NextResponse } from "next/server";
import { routeToPlace, type RoutePerson } from "@/lib/meeting/route";

export async function POST(request: Request) {
  let payload: { place?: { latitude?: unknown; longitude?: unknown }; people?: unknown };
  try {
    payload = (await request.json()) as { place?: { latitude?: unknown; longitude?: unknown }; people?: unknown };
  } catch {
    return NextResponse.json({ message: "We couldn't draw a walking route just now." }, { status: 400 });
  }

  const latitude = Number(payload.place?.latitude);
  const longitude = Number(payload.place?.longitude);
  const people = Array.isArray(payload.people) ? payload.people : [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || people.length < 1 || people.length > 8) {
    return NextResponse.json({ message: "We couldn't draw a walking route just now." }, { status: 400 });
  }

  const points: RoutePerson[] = [];
  for (const person of people) {
    const item = person as { name?: unknown; latitude?: unknown; longitude?: unknown };
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 32) : "";
    const personLatitude = Number(item.latitude);
    const personLongitude = Number(item.longitude);
    if (!name || !Number.isFinite(personLatitude) || !Number.isFinite(personLongitude)) continue;
    points.push({ name, latitude: personLatitude, longitude: personLongitude });
  }
  if (points.length === 0) {
    return NextResponse.json({ message: "We couldn't draw a walking route just now." }, { status: 400 });
  }

  try {
    const paths = await routeToPlace(points, { latitude, longitude });
    return NextResponse.json({ paths });
  } catch (error) {
    console.error("route lookup failed", error);
    return NextResponse.json({ message: "We couldn't draw a walking route just now." }, { status: 502 });
  }
}
