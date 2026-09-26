import { resolveActivity, type ActivityId } from "@/lib/meeting/activities";

const ALLOWED: ActivityId[] = ["restaurant", "cafe", "football", "park", "shopping", "movie", "gym", "bar"];

export async function interpretPrompt(prompt: string) {
  const text = prompt.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return null;
  const local = resolveActivity("other", text);
  const key = process.env.LLM_API_KEY;
  const specific = ["Restaurant", "Cafe", "Football", "Park", "Shopping", "Movie", "Gym", "Bar"].includes(local?.label ?? "");
  if (!key || specific) return local;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${process.env.LLM_BASE_URL || "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "deepseek-chat",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Choose the closest activity id for a place request. Reply JSON {"id":"cafe"}. Allowed ids: restaurant, cafe, football, park, shopping, movie, gym, bar. Never invent a place.',
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!response.ok) return local;
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return local;
    const parsed = JSON.parse(content) as { id?: unknown };
    const id = typeof parsed.id === "string" ? parsed.id : "";
    if (!ALLOWED.includes(id as ActivityId)) return local;
    return resolveActivity(id);
  } catch {
    return local;
  } finally {
    clearTimeout(timer);
  }
}
