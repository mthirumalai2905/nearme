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

const phoneOrigin = (process.env.NEXT_PUBLIC_APP_URL || "https://nearme-sand.vercel.app").replace(/\/$/, "");

function isPrivateHost(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  if (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

export function shareUrl(sessionId: string) {
  const path = sharePath(sessionId);
  if (typeof window === "undefined" || isPrivateHost(window.location.hostname)) return `${phoneOrigin}${path}`;
  return `${window.location.origin}${path}`;
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.readOnly = true;
      field.style.position = "fixed";
      field.style.top = "0";
      field.style.left = "0";
      field.style.fontSize = "16px";
      document.body.append(field);
      field.focus();
      field.select();
      field.setSelectionRange(0, value.length);
      const copied = document.execCommand("copy");
      field.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

export async function shareLink(url: string) {
  if (typeof navigator.share === "function") {
    await navigator.share({ title: "Near Me", text: "Join me on Near Me.", url });
    return "shared" as const;
  }
  return (await copyText(url)) ? ("copied" as const) : ("failed" as const);
}
