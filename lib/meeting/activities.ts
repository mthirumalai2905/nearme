export const ACTIVITIES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Cafe" },
  { id: "football", label: "Football" },
  { id: "park", label: "Park" },
  { id: "shopping", label: "Shopping" },
  { id: "movie", label: "Movie" },
  { id: "gym", label: "Gym" },
  { id: "bar", label: "Bar" },
  { id: "other", label: "Other" },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];

const TAGS: Record<Exclude<ActivityId, "other">, Array<[string, string]>> = {
  restaurant: [
    ["amenity", "restaurant"],
    ["amenity", "fast_food"],
  ],
  cafe: [["amenity", "cafe"]],
  football: [
    ["leisure", "pitch"],
    ["sport", "soccer"],
  ],
  park: [["leisure", "park"]],
  shopping: [
    ["shop", "mall"],
    ["shop", "department_store"],
  ],
  movie: [["amenity", "cinema"]],
  gym: [
    ["leisure", "fitness_centre"],
    ["leisure", "sports_centre"],
  ],
  bar: [
    ["amenity", "bar"],
    ["amenity", "pub"],
  ],
};

const KEYWORDS: Array<[RegExp, Exclude<ActivityId, "other">]> = [
  [/coffee|cafe|tea/, "cafe"],
  [/food|eat|dinner|lunch|restaurant/, "restaurant"],
  [/soccer|football|pitch/, "football"],
  [/park|picnic|outdoor/, "park"],
  [/shop|mall|store/, "shopping"],
  [/movie|cinema|film/, "movie"],
  [/gym|workout|fitness/, "gym"],
  [/bar|drink|pub/, "bar"],
];

export function isActivityId(value: string): value is ActivityId {
  return ACTIVITIES.some((activity) => activity.id === value);
}

export function resolveActivity(id: string, other = "") {
  if (!isActivityId(id)) return null;
  if (id !== "other") {
    const activity = ACTIVITIES.find((item) => item.id === id);
    return { tags: TAGS[id], label: activity?.label ?? "Place" };
  }

  const text = other.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!text || /[\u0000-\u001F]/.test(text)) return null;
  const matched = KEYWORDS.find(([pattern]) => pattern.test(text.toLowerCase()));
  if (matched) {
    const activity = ACTIVITIES.find((item) => item.id === matched[1]);
    return { tags: TAGS[matched[1]], label: activity?.label ?? text };
  }

  return {
    tags: [
      ["amenity", "cafe"],
      ["amenity", "restaurant"],
      ["leisure", "park"],
    ] as Array<[string, string]>,
    label: text,
  };
}
