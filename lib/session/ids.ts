const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function isSessionId(value: string) {
  return new RegExp(`^[${ALPHABET}]{8}$`).test(value);
}

export function parseSessionInput(input: string) {
  const trimmed = input.trim();
  if (isSessionId(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const joinAt = parts.findIndex((part) => part === "join");
    const candidate = joinAt >= 0 ? parts[joinAt + 1] : parts.at(-1);
    if (candidate && isSessionId(candidate)) return candidate;
  } catch {
    return null;
  }

  return null;
}

export function sharePath(sessionId: string) {
  return `/join/${sessionId}`;
}

export function shareUrl(sessionId: string) {
  if (typeof window === "undefined") return sharePath(sessionId);
  return `${window.location.origin}${sharePath(sessionId)}`;
}
