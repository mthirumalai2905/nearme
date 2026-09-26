export function cleanDisplayName(input: string) {
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 32) return null;
  if (/[\u0000-\u001F\u007F]/.test(name)) return null;
  return name;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
