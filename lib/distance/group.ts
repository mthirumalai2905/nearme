import { calculateDistance, maxPairwiseDistance } from "@/lib/distance/haversine";
import { formatDistance, formatSpan } from "@/lib/distance/format";

export type GroupPerson = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export function summarizeGroup(people: GroupPerson[], referenceId: string) {
  if (people.length < 2) {
    return { headline: "Waiting for others", detail: null as string | null };
  }

  const span = maxPairwiseDistance(people);
  const reference = people.find((person) => person.id === referenceId) ?? people[0];
  let farthest = { name: "", meters: -1 };
  for (const person of people) {
    if (person.id === reference.id) continue;
    const meters = calculateDistance(
      reference.latitude,
      reference.longitude,
      person.latitude,
      person.longitude,
    );
    if (meters > farthest.meters) farthest = { name: person.name, meters };
  }

  if (span <= 5000) {
    return {
      headline: `Everyone is within ${formatSpan(span)}`,
      detail: farthest.name ? `${farthest.name} is the farthest` : null,
    };
  }

  return {
    headline: farthest.name
      ? `${farthest.name} is ${formatDistance(farthest.meters)}`
      : "People are spread out",
    detail: farthest.name ? `${farthest.name} is the farthest` : null,
  };
}
