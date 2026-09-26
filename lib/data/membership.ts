const MEMBER = "nearme.member.";
const CREATOR = "nearme.creator.";

export type Membership = {
  participantId: string;
  token: string;
  isCreator: boolean;
  displayName: string;
};

function storage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readMembership(sessionId: string): Membership | null {
  const raw = storage()?.getItem(MEMBER + sessionId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Membership>;
    if (!parsed.participantId || !parsed.token || !parsed.displayName) return null;
    return {
      participantId: parsed.participantId,
      token: parsed.token,
      isCreator: Boolean(parsed.isCreator),
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}

export function writeMembership(sessionId: string, membership: Membership) {
  storage()?.setItem(MEMBER + sessionId, JSON.stringify(membership));
}

export function clearMembership(sessionId: string) {
  storage()?.removeItem(MEMBER + sessionId);
}

export function readCreatorToken(sessionId: string) {
  return storage()?.getItem(CREATOR + sessionId) ?? null;
}

export function writeCreatorToken(sessionId: string, token: string) {
  storage()?.setItem(CREATOR + sessionId, token);
}

export function hasMembership(sessionId: string) {
  return readMembership(sessionId) !== null;
}
