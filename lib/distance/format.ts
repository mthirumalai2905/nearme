export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 30) return "Nearby";
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `${rounded} m away`;
  }
  const kilometers = meters / 1000;
  if (kilometers < 10) {
    const rounded = Math.round(kilometers * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${text} km away`;
  }
  return `${Math.round(kilometers)} km away`;
}

export function formatSpan(meters: number) {
  if (meters < 1000) {
    const rounded = Math.max(50, Math.ceil(meters / 50) * 50);
    return `${rounded} m`;
  }
  const kilometers = meters / 1000;
  if (kilometers < 10) {
    const rounded = Math.ceil(kilometers * 2) / 2;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} km`;
  }
  return `${Math.ceil(kilometers)} km`;
}
