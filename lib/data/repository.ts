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

type MeetEntry = {
  channel: RealtimeChannel;
  ready: boolean;
  pending: MeetPlan | null;
  listeners: Set<(plan: MeetPlan) => void>;
};

const meets = new Map<string, MeetEntry>();

function meetEntry(sessionId: string) {
  const existing = meets.get(sessionId);
  if (existing) return existing;
  const channel = getSupabase().channel(`meet:${sessionId}`, {
    config: { broadcast: { self: false } },
  });
  const current: MeetEntry = { channel, ready: false, pending: null, listeners: new Set() };
  channel.on("broadcast", { event: "plan" }, ({ payload }) => {
    const plan = parseMeetPlan(payload);
    if (!plan) return;
    current.listeners.forEach((listener) => listener(plan));
  });
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    current.ready = true;
    if (!current.pending) return;
    const plan = current.pending;
    current.pending = null;
    void channel.send({ type: "broadcast", event: "plan", payload: plan });
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
      if (current.listeners.size === 0) {
        void getSupabase().removeChannel(current.channel);
        meets.delete(sessionId);
      }
    };
  },
};

export function sessionEnded(status: SessionStatus | undefined) {
  return status === "ended" || status === "expired";
}
