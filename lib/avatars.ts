export const AVATARS = [
  "/avatars/01.jpg",
  "/avatars/02.jpg",
  "/avatars/03.jpg",
  "/avatars/04.jpg",
  "/avatars/05.jpg",
  "/avatars/06.jpg",
  "/avatars/07.jpg",
  "/avatars/08.jpg",
  "/avatars/09.jpg",
  "/avatars/10.jpg",
  "/avatars/11.jpg",
  "/avatars/12.jpg",
] as const;

function hashId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function assignAvatars(idsInJoinOrder: string[]) {
  const used = new Set<number>();
  const assigned = new Map<string, string>();

  for (const id of idsInJoinOrder) {
    if (assigned.has(id)) continue;
    let index = hashId(id) % AVATARS.length;
    let steps = 0;
    while (used.has(index) && steps < AVATARS.length) {
      index = (index + 1) % AVATARS.length;
      steps += 1;
    }
    used.add(index);
    assigned.set(id, AVATARS[index]);
  }

  return assigned;
}
