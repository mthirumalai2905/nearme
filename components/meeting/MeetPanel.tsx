"use client";

import { useState } from "react";
import type { ScoredPlace } from "@/lib/meeting/fairness";
import type { MeetPath } from "@/lib/meeting/plan";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type MeetPerson = {
  name: string;
  latitude: number;
  longitude: number;
};

const SUGGESTIONS = ["Nearest cafe", "Nearest restaurant", "A nearby place"];

function fallbackImage(category: string) {
  const key = category.toLowerCase();
  if (key.includes("cafe")) return "/places/cafe.svg";
  if (key.includes("restaurant")) return "/places/restaurant.svg";
  if (key.includes("park")) return "/places/park.svg";
  return "/places/place.svg";
}

export function MeetPanel({
  people,
  onPlace,
}: {
  people: MeetPerson[];
  onPlace: (plan: { place: { id: string; name: string; latitude: number; longitude: number; image: string | null }; paths: MeetPath[] } | null) => void;
}) {
  const [prompt, setPrompt] = useState("Nearest cafe");
  const [places, setPlaces] = useState<ScoredPlace[]>([]);
  const [paths, setPaths] = useState<MeetPath[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "routing" | "empty" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function route(place: ScoredPlace) {
    setSelected(place.id);
    setStatus("routing");
    onPlace({
      place: {
        id: place.id,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        image: place.image,
      },
      paths: [],
    });
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place: { latitude: place.latitude, longitude: place.longitude },
          people,
        }),
      });
      const body = (await response.json()) as { paths?: MeetPath[]; message?: string };
      if (!response.ok) {
        setStatus("error");
        setError(body.message || "We couldn't draw a walking route just now.");
        return;
      }
      const next = body.paths ?? [];
      setPaths(next);
      setStatus("idle");
      onPlace({
        place: {
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          image: place.image,
        },
        paths: next,
      });
    } catch {
      setStatus("error");
      setError("We couldn't draw a walking route just now.");
    }
  }

  async function find() {
    setStatus("loading");
    setError(null);
    setPaths([]);
    onPlace(null);
    try {
      const response = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, people }),
      });
      const body = (await response.json()) as { places?: ScoredPlace[]; message?: string };
      if (!response.ok) {
        setStatus("error");
        setError(body.message || "We couldn't look up places just now. Try again in a moment.");
        setPlaces([]);
        return;
      }
      const next = body.places ?? [];
      setPlaces(next);
      setStatus(next.length ? "idle" : "empty");
      if (next[0]) await route(next[0]);
    } catch {
      setStatus("error");
      setError("We couldn't look up places just now. Try again in a moment.");
    }
  }

  if (people.length < 1) {
    return <p className="text-[15px] leading-relaxed text-muted">Share your location to look for a nearby place.</p>;
  }

  return (
    <div>
      <p className="text-[15px] font-medium">Where should you meet?</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Place ideas">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={prompt === item}
            onClick={() => setPrompt(item)}
            className={cn(
              "h-9 rounded-full border px-3 text-[13px] transition duration-200",
              prompt === item ? "border-ink bg-ink text-bg" : "border-line bg-bg text-ink",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[13px] text-muted">
        Ask for a place
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Nearest cafe, restaurant, park..."
          className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[16px] text-ink"
        />
      </label>
      <Button className="mt-4" size="md" onClick={() => void find()} disabled={status === "loading" || status === "routing" || prompt.trim().length === 0}>
        {status === "loading" ? "Finding places..." : status === "routing" ? "Drawing the walk..." : "Find places"}
      </Button>
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      {status === "empty" ? (
        <p className="mt-3 text-[14px] text-muted">Nothing nearby matched. Try another place.</p>
      ) : null}
      {places.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-[20px] font-semibold tracking-tight">Good places to meet</h3>
          <p className="mt-1 text-[14px] text-muted">
            {people.length > 1 ? "Somewhere roughly between everyone" : "The closest matches around you"}
          </p>
          <ul className="mt-3 divide-y divide-line">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="flex w-full gap-3 py-3 text-left"
                  aria-pressed={selected === place.id}
                  onClick={() => void route(place)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={place.image ?? fallbackImage(place.category)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0">
                  <span className="block text-[16px] font-medium">{place.name}</span>
                  {place.address ? <span className="mt-1 block text-[13px] text-muted">{place.address}</span> : null}
                  <span className="mt-2 block space-y-0.5 text-[14px] text-muted">
                    {(selected === place.id && paths.length > 0 ? paths : place.travel).map((leg) => (
                      <span key={leg.name} className="block tabular-nums">
                        About {leg.minutes} min from {leg.name}
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 block text-[13px] leading-5 text-muted">
                    <span className="font-medium text-ink">Why this place? </span>
                    {place.why}
                  </span>
                  </span>
                </button>
                <a
                  className="mb-3 inline-block text-[14px] text-accent"
                  href={`https://www.openstreetmap.org/directions?to=${place.latitude}%2C${place.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-5 text-muted">
            The blue line on the map is the walk. Everyone in this session can see it.
          </p>
        </div>
      ) : null}
    </div>
  );
}
