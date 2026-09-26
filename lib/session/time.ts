export function formatTimeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `Ends in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Ends in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Ends in ${days} day${days === 1 ? "" : "s"}`;
}
