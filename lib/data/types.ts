export type SessionStatus = "active" | "ended" | "expired";
export type ParticipantStatus = "active" | "inactive" | "left";

export type PublicParticipant = {
  id: string;
  displayName: string;
  status: ParticipantStatus;
  lastSeen: string;
  sharing: boolean;
};

export type PublicLocation = {
  participantId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
};

export type SessionInfo = {
  id: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
};

export type SessionSnapshot = {
  revision: string;
  session: SessionInfo;
  participantCount: number;
  participants: PublicParticipant[];
  locations: PublicLocation[];
  selfId: string | null;
  isCreator: boolean;
};

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};
