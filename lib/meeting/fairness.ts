import { calculateDistance, maxPairwiseDistance } from "../distance/haversine.ts";

export type PersonPoint = {
  name: string;
  latitude: number;
  longitude: number;
};

export type PlaceCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  address: string | null;
  hours: string | null;
};

export type TravelLeg = {
  name: string;
  minutes: number;
  meters: number;
};

export type ScoredPlace = PlaceCandidate & {
  travel: TravelLeg[];
  why: string;
  score: number;
};

export function travelMinutes(meters: number, spreadMeters: number) {
  const walking = spreadMeters < 2500 && meters < 2200;
  const kilometersPerHour = walking ? 4.8 : 26;
  return Math.max(1, Math.round(meters / 1000 / kilometersPerHour * 60));
}

export function searchRadiusMeters(spreadMeters: number) {
  if (spreadMeters < 1500) return 1200;
  if (spreadMeters < 5000) return 2500;
  if (spreadMeters < 15000) return 4000;
  return 7000;
}

function explainPlace(travel: TravelLeg[], activityLabel: string) {
  if (travel.length === 0) {
    return `Good option because it matches ${activityLabel.toLowerCase()}.`;
  }
  const farthest = travel.reduce((left, right) => (left.minutes > right.minutes ? left : right));
  const nearest = travel.reduce((left, right) => (left.minutes < right.minutes ? left : right));
  if (farthest.minutes - nearest.minutes <= 8) {
    return "Good option because it is relatively close to everyone and matches your selected activity.";
  }
  return `About ${farthest.minutes} min from ${farthest.name}, the farthest person. Other places were less fair for the rest of the group.`;
}

export function rankPlaces(people: PersonPoint[], places: PlaceCandidate[], activityLabel: string) {
  const spread = maxPairwiseDistance(people);
  const mode = spread < 2500 ? "walking" : "city";
  const scored = places.map((place) => {
    const travel = people
      .map((person) => {
        const meters = calculateDistance(
          person.latitude,
          person.longitude,
          place.latitude,
          place.longitude,
        );
        return {
          name: person.name,
          meters: Math.round(meters),
          minutes: travelMinutes(meters, spread),
        };
      })
      .sort((left, right) => left.minutes - right.minutes);
    const minutes = travel.map((leg) => leg.minutes);
    const maxTime = Math.max(...minutes);
    const minTime = Math.min(...minutes);
    const average = minutes.reduce((sum, value) => sum + value, 0) / minutes.length;
    const score = maxTime * 1.4 + (maxTime - minTime) * 0.8 + average * 0.3;
    return {
      ...place,
      travel,
      score,
      why: explainPlace(travel, activityLabel),
    };
  });

  scored.sort((left, right) => left.score - right.score);
  return { mode, places: scored.slice(0, 5) } as const;
}
