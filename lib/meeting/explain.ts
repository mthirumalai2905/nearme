import type { ScoredPlace } from "@/lib/meeting/fairness";

type ModelResponse = {
  order?: unknown;
  reasons?: unknown;
};

export async function maybeRewriteReasons(
  activity: string,
  places: ScoredPlace[],
  prefs?: { stars: number | null; budget: number | null },
) {
  const key = process.env.LLM_API_KEY;
  if (!key || places.length < 1) return places;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${process.env.LLM_BASE_URL || "https://api.openai.com/v1"}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You reorder existing meeting places and write one short reason each. Return JSON {\"order\":[\"id\"],\"reasons\":{\"id\":\"sentence\"}}. Use only provided ids. Never invent places, ratings, prices, or hours. If a rating or budget was requested but is not in the data, say it is not listed.",
            },
            {
              role: "user",
              content: JSON.stringify({
                activity,
                minimumStars: prefs?.stars ?? null,
                budgetPerPerson: prefs?.budget ?? null,
                places: places.map((place) => ({
                  id: place.id,
                  name: place.name,
                  category: place.category,
                  hours: place.hours,
                  stars: place.stars ?? null,
                  travel: place.travel.map((leg) => ({
                    name: leg.name,
                    minutes: leg.minutes,
                  })),
                })),
              }),
            },
          ],
        }),
      },
    );
    if (!response.ok) return places;
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return places;
    const parsed = JSON.parse(content) as ModelResponse;
    const known = new Map(places.map((place) => [place.id, place]));
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is string => typeof id === "string" && known.has(id))
      : [];
    if (order.length !== places.length) return places;
    const reasons =
      parsed.reasons && typeof parsed.reasons === "object"
        ? (parsed.reasons as Record<string, unknown>)
        : {};
    return order.map((id) => {
      const place = known.get(id)!;
      const reason = reasons[id];
      return {
        ...place,
        why: typeof reason === "string" && reason.trim().length > 0 && reason.length < 180
          ? reason.trim()
          : place.why,
      };
    });
  } catch {
    return places;
  } finally {
    clearTimeout(timer);
  }
}
