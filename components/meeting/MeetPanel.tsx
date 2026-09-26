"use client";

import { useState } from "react";
import { ACTIVITIES } from "@/lib/meeting/activities";
import type { ScoredPlace } from "@/lib/meeting/fairness";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type MeetPerson = {
  name: string;
  latitude: number;
  longitude: number;
};

export function MeetPanel({
  people,
  onPlace,
}: {
  people: MeetPerson[];
  onPlace: (place: { id: string; name: string; latitude: number; longitude: number } | null) => void;
}) {
  const [activity, setActivity] = useState("cafe");
  const [other, setOther] = useState("");
  const [places, setPlaces] = useState<ScoredPlace[]>([]);
  const [mode, setMode] = useState<"walking" | "city" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setStatus("loading");
    setError(null);
    onPlace(null);
    try {
      const response = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity, other, people }),
      });
      const body = (await response.json()) as { places?: ScoredPlace[]; mode?: "walking" | "city"; message?: string };
      if (!response.ok) {
        setStatus("error");
        setError(body.message || "We couldn't look up places just now. Try again in a moment.");
        setPlaces([]);
        return;
      }
      const next = body.places ?? [];
      setPlaces(next);
      setMode(body.mode ?? null);
      setSelected(next[0]?.id ?? null);
      setStatus(next.length ? "idle" : "empty");
      if (next[0]) onPlace(next[0]);
    } catch {
      setStatus("error");
      setError("We couldn't look up places just now. Try again in a moment.");
    }
  }

  if (people.length < 2) {
    return <p className="text-[15px] leading-relaxed text-muted">Wait until someone else is on the map.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Activity">
        {ACTIVITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={activity === item.id}
            onClick={() => setActivity(item.id)}
            className={cn(
              "h-9 rounded-full border px-3 text-[13px] transition duration-200",
              activity === item.id ? "border-ink bg-ink text-bg" : "border-line bg-bg text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {activity === "other" ? (
        <label className="mt-3 block text-[13px] text-muted">
          What are you looking for?
          <input
            value={other}
            onChange={(event) => setOther(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[16px] text-ink"
          />
        </label>
      ) : null}
      <Button className="mt-4" size="md" onClick={() => void find()} disabled={status === "loading" || (activity === "other" && other.trim().length === 0)}>
        {status === "loading" ? "Finding places..." : "Find places"}
      </Button>
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      {status === "empty" ? (
        <p className="mt-3 text-[14px] text-muted">Nothing nearby matched. Try another activity.</p>
      ) : null}
      {places.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-[20px] font-semibold tracking-tight">Good places to meet</h3>
          <p className="mt-1 text-[14px] text-muted">Somewhere roughly between everyone</p>
          <ul className="mt-3 divide-y divide-line">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="w-full py-3 text-left"
                  aria-pressed={selected === place.id}
                  onClick={() => {
                    setSelected(place.id);
                    onPlace(place);
                  }}
                >
                  <span className="block text-[16px] font-medium">{place.name}</span>
                  {place.address ? <span className="mt-1 block text-[13px] text-muted">{place.address}</span> : null}
                  <span className="mt-2 block space-y-0.5 text-[14px] text-muted">
                    {place.travel.map((leg) => (
                      <span key={leg.name} className="block tabular-nums">
                        About {leg.minutes} min from {leg.name}
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 block text-[13px] leading-5 text-muted">
                    <span className="font-medium text-ink">Why this place? </span>
                    {place.why}
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
            {mode === "walking"
              ? "Times assume a relaxed walk, not live traffic."
              : "Times are approximate city travel, not live traffic."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
