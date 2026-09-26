import { SessionError } from "@/lib/data/errors";
import {
  readCreatorToken,
  readMembership,
  writeCreatorToken,
  writeMembership,
} from "@/lib/data/membership";
import type { LocationFix, SessionInfo, SessionSnapshot, SessionStatus } from "@/lib/data/types";
import { parseMeetPlan, type MeetPlan } from "@/lib/meeting/plan";
import { shareUrl } from "@/lib/session/ids";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RpcBody = {
  ok?: boolean;
  code?: string;
  message?: string;
  revision?: string;
  session?: SessionInfo;
  sessionId?: string;
  creatorToken?: string;
  expiresAt?: string;
  participantId?: string;
  participantToken?: string;
  isCreator?: boolean;
  participantCount?: number;
  participants?: SessionSnapshot["participants"];
  locations?: SessionSnapshot["locations"];
  selfId?: string | null;
  throttled?: boolean;
};

function asSnapshot(body: RpcBody, fallback?: { selfId: string | null; isCreator: boolean }): SessionSnapshot {
  if (!body.session || !body.participants || !body.locations || !body.revision) {
    throw new SessionError("Something went wrong. Try again.", "error");
  }
  const selfId = body.selfId ?? fallback?.selfId ?? null;
  return {
    revision: body.revision,
    session: body.session,
    participantCount: body.participantCount ?? body.participants.length,
    participants: body.participants,
    locations: body.locations,
    selfId,
    isCreator: body.selfId ? Boolean(body.isCreator) : Boolean(fallback?.isCreator),
  };
}

async function rpc(fn: string, args?: Record<string, unknown>) {
  if (!isSupabaseConfigured()) {
    throw new SessionError("Near Me isn't connected yet.", "config");
  }
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    throw new SessionError(
      offline ? "You're offline. We'll reconnect automatically." : "Something went wrong. Try again.",
      offline ? "offline" : "error",
    );
  }
  const body = (typeof data === "string" ? JSON.parse(data) : data) as RpcBody;
  if (!body?.ok) {
    throw new SessionError(body?.message || "Something went wrong. Try again.", body?.code || "error");
  }
  return body;
}

export type MeetNote = {
  id: string;
  name: string;
  text: string;
  at: number;
};

export type MeetLike = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  image: string | null;
  category: string;
  address: string | null;
  by: string;
};

type MeetEntry = {
  channel: RealtimeChannel;
  ready: boolean;
  pending: MeetPlan | null;
  pendingNotes: MeetNote[];
  pendingLikes: MeetLike[];
  listeners: Set<(plan: MeetPlan) => void>;
  noteListeners: Set<(note: MeetNote) => void>;
  likeListeners: Set<(like: MeetLike) => void>;
};

const meets = new Map<string, MeetEntry>();

function parseNote(value: unknown): MeetNote | null {
  if (!value || typeof value !== "object") return null;
  const note = value as { id?: unknown; name?: unknown; text?: unknown; at?: unknown };
  if (typeof note.id !== "string" || typeof note.name !== "string" || typeof note.text !== "string") return null;
  const text = note.text.trim().slice(0, 240);
  if (!text) return null;
  return {
    id: note.id.slice(0, 80),
    name: note.name.trim().slice(0, 32) || "Someone",
    text,
    at: Number.isFinite(Number(note.at)) ? Number(note.at) : Date.now(),
  };
}

function parseLike(value: unknown): MeetLike | null {
  if (!value || typeof value !== "object") return null;
  const like = value as Partial<MeetLike>;
  const latitude = Number(like.latitude);
  const longitude = Number(like.longitude);
  if (typeof like.id !== "string" || typeof like.name !== "string") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    id: like.id.slice(0, 80),
    name: like.name.trim().slice(0, 80),
    latitude,
    longitude,
    image: typeof like.image === "string" && like.image.startsWith("https://") ? like.image.slice(0, 400) : null,
    category: typeof like.category === "string" ? like.category.slice(0, 40) : "Place",
    address: typeof like.address === "string" ? like.address.slice(0, 120) : null,
    by: typeof like.by === "string" && like.by.trim() ? like.by.trim().slice(0, 32) : "Someone",
  };
}

function releaseMeet(sessionId: string) {
  const current = meets.get(sessionId);
  if (!current || current.listeners.size > 0 || current.noteListeners.size > 0 || current.likeListeners.size > 0) return;
  void getSupabase().removeChannel(current.channel);
  meets.delete(sessionId);
}

function meetEntry(sessionId: string) {
  const existing = meets.get(sessionId);
  if (existing) return existing;
  const channel = getSupabase().channel(`meet:${sessionId}`, {
    config: { broadcast: { self: false } },
  });
  const current: MeetEntry = {
    channel,
    ready: false,
    pending: null,
    pendingNotes: [],
    pendingLikes: [],
    listeners: new Set(),
    noteListeners: new Set(),
    likeListeners: new Set(),
  };
  channel.on("broadcast", { event: "plan" }, ({ payload }) => {
    const plan = parseMeetPlan(payload);
    if (!plan) return;
    current.listeners.forEach((listener) => listener(plan));
  });
  channel.on("broadcast", { event: "note" }, ({ payload }) => {
    const note = parseNote(payload);
    if (!note) return;
    current.noteListeners.forEach((listener) => listener(note));
  });
  channel.on("broadcast", { event: "like" }, ({ payload }) => {
    const like = parseLike(payload);
    if (!like) return;
    current.likeListeners.forEach((listener) => listener(like));
  });
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    current.ready = true;
    if (current.pending) {
      const plan = current.pending;
      current.pending = null;
      void channel.send({ type: "broadcast", event: "plan", payload: plan });
    }
    const notes = current.pendingNotes.splice(0);
    for (const note of notes) void channel.send({ type: "broadcast", event: "note", payload: note });
    const likes = current.pendingLikes.splice(0);
    for (const like of likes) void channel.send({ type: "broadcast", event: "like", payload: like });
  });
  meets.set(sessionId, current);
  return current;
}

export const repository = {
  async createSession() {
    const body = await rpc("create_session");
    if (!body.sessionId || !body.creatorToken || !body.expiresAt) {
      throw new SessionError("Something went wrong. Try again.", "error");
    }
    writeCreatorToken(body.sessionId, body.creatorToken);
    return {
      sessionId: body.sessionId,
      expiresAt: body.expiresAt,
      creatorToken: body.creatorToken,
    };
  },

  async preview(sessionId: string): Promise<SessionInfo> {
    const body = await rpc("session_preview", { p_session_id: sessionId });
    if (!body.session) throw new SessionError("This session doesn't exist.", "missing");
    return body.session;
  },

  async join(sessionId: string, displayName: string) {
    const existing = readMembership(sessionId);
    const body = await rpc("join_session", {
      p_session_id: sessionId,
      p_display_name: displayName,
      p_participant_token: existing?.token ?? null,
      p_creator_token: existing ? null : readCreatorToken(sessionId),
    });
    if (!body.participantId || !body.participantToken) {
      throw new SessionError("Something went wrong. Try again.", "error");
    }
    writeMembership(sessionId, {
      participantId: body.participantId,
      token: body.participantToken,
      isCreator: Boolean(body.isCreator),
      displayName,
    });
    return asSnapshot(body, {
      selfId: body.participantId,
      isCreator: Boolean(body.isCreator),
    });
  },

  async load(sessionId: string) {
    const membership = readMembership(sessionId);
    if (!membership) return null;
    try {
      const body = await rpc("session_state", {
        p_session_id: sessionId,
        p_participant_token: membership.token,
      });
      return asSnapshot(body, {
        selfId: membership.participantId,
        isCreator: membership.isCreator,
      });
    } catch (error) {
      if (error instanceof SessionError && (error.code === "not_member" || error.code === "missing")) {
        return null;
      }
      throw error;
    }
  },

  async updateLocation(sessionId: string, fix: LocationFix) {
    const membership = readMembership(sessionId);
    if (!membership) return;
    await rpc("update_location", {
      p_session_id: sessionId,
      p_participant_token: membership.token,
      p_latitude: fix.latitude,
      p_longitude: fix.longitude,
      p_accuracy: fix.accuracy,
    });
  },

  async stopSharing(sessionId: string) {
    const membership = readMembership(sessionId);
    if (!membership) return;
    await rpc("stop_sharing", {
      p_session_id: sessionId,
      p_participant_token: membership.token,
    });
  },

  async heartbeat(sessionId: string) {
    const membership = readMembership(sessionId);
    if (!membership) return;
    await rpc("heartbeat", {
      p_session_id: sessionId,
      p_participant_token: membership.token,
    });
  },

  async endSession(sessionId: string) {
    const token = readCreatorToken(sessionId);
    if (!token) throw new SessionError("Only the person who created this session can end it.", "forbidden");
    await rpc("end_session", {
      p_session_id: sessionId,
      p_creator_token: token,
    });
  },

  async leaveSession(sessionId: string) {
    const membership = readMembership(sessionId);
    if (!membership) return;
    await rpc("leave_session", {
      p_session_id: sessionId,
      p_participant_token: membership.token,
    });
  },

  subscribe(sessionId: string, onSnapshot: (snapshot: SessionSnapshot) => void) {
    const supabase = getSupabase();
    const channel = supabase.channel(`session:${sessionId}`);
    channel.on("broadcast", { event: "sync" }, ({ payload }) => {
      try {
        const body = payload as RpcBody;
        if (!body?.session) return;
        const membership = readMembership(sessionId);
        onSnapshot(
          asSnapshot(
            { ...body, ok: true, selfId: body.selfId ?? null },
            membership
              ? { selfId: membership.participantId, isCreator: membership.isCreator }
              : undefined,
          ),
        );
      } catch {
        void repository.load(sessionId).then((snapshot) => {
          if (snapshot) onSnapshot(snapshot);
        });
      }
    });
    let live = false;
    channel.subscribe((status) => {
      live = status === "SUBSCRIBED";
    });
    const poll = window.setInterval(() => {
      if (live) return;
      void repository.load(sessionId).then((snapshot) => {
        if (snapshot) onSnapshot(snapshot);
      });
    }, 10000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  },

  shareUrl,

  publishMeet(sessionId: string, plan: MeetPlan) {
    const current = meetEntry(sessionId);
    const safe = parseMeetPlan(plan);
    if (!safe) return;
    if (!current.ready) {
      current.pending = safe;
      return;
    }
    void current.channel.send({ type: "broadcast", event: "plan", payload: safe });
  },

  subscribeMeet(sessionId: string, onPlan: (plan: MeetPlan) => void) {
    const current = meetEntry(sessionId);
    current.listeners.add(onPlan);
    return () => {
      current.listeners.delete(onPlan);
      releaseMeet(sessionId);
    };
  },

  publishNote(sessionId: string, note: MeetNote) {
    const current = meetEntry(sessionId);
    const safe = parseNote(note);
    if (!safe) return;
    if (!current.ready) {
      current.pendingNotes.push(safe);
      return;
    }
    void current.channel.send({ type: "broadcast", event: "note", payload: safe });
  },

  subscribeNotes(sessionId: string, onNote: (note: MeetNote) => void) {
    const current = meetEntry(sessionId);
    current.noteListeners.add(onNote);
    return () => {
      current.noteListeners.delete(onNote);
      releaseMeet(sessionId);
    };
  },

  publishLike(sessionId: string, like: MeetLike) {
    const current = meetEntry(sessionId);
    const safe = parseLike(like);
    if (!safe) return;
    if (!current.ready) {
      current.pendingLikes.push(safe);
      return;
    }
    void current.channel.send({ type: "broadcast", event: "like", payload: safe });
  },

  subscribeLikes(sessionId: string, onLike: (like: MeetLike) => void) {
    const current = meetEntry(sessionId);
    current.likeListeners.add(onLike);
    return () => {
      current.likeListeners.delete(onLike);
      releaseMeet(sessionId);
    };
  },
};

export function sessionEnded(status: SessionStatus | undefined) {
  return status === "ended" || status === "expired";
}
