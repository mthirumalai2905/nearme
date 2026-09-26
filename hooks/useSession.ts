"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { messageFrom, SessionError } from "@/lib/data/errors";
import { hasMembership, readCreatorToken } from "@/lib/data/membership";
import { repository, sessionEnded } from "@/lib/data/repository";
import type { LocationFix, SessionInfo, SessionSnapshot } from "@/lib/data/types";
import { useParticipants } from "@/hooks/useParticipants";

const MEMBER_EVENT = "nearme-member";

function subscribeMembership(onChange: () => void) {
  window.addEventListener(MEMBER_EVENT, onChange);
  return () => window.removeEventListener(MEMBER_EVENT, onChange);
}

export function useSession(sessionId: string) {
  const joined = useSyncExternalStore(
    subscribeMembership,
    () => hasMembership(sessionId),
    () => false,
  );
  const [preview, setPreview] = useState<SessionInfo | null>(null);
  const [failure, setFailure] = useState<{ id: string; code: string; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const participants = useParticipants(joined ? sessionId : null);

  useEffect(() => {
    let cancelled = false;
    void repository
      .preview(sessionId)
      .then((session) => {
        if (cancelled) return;
        setPreview(session);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof SessionError && error.code === "missing") {
          setFailure({ id: sessionId, code: "missing", message: error.message });
          return;
        }
        setFailure({
          id: sessionId,
          code: "error",
          message: messageFrom(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const join = useCallback(
    async (displayName: string) => {
      setActionError(null);
      const snapshot = await repository.join(sessionId, displayName);
      window.dispatchEvent(new Event(MEMBER_EVENT));
      participants.apply(snapshot);
      return snapshot;
    },
    [participants, sessionId],
  );

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      setActionError(null);
      await action();
    } catch (error) {
      setActionError(messageFrom(error));
      throw error;
    }
  }, []);

  const snapshot: SessionSnapshot | null = participants.snapshot;
  const previewMatches = preview?.id === sessionId;
  const failedHere = failure?.id === sessionId ? failure : null;
  const previewPhase = failedHere?.code === "missing"
    ? "missing"
    : failedHere
      ? "error"
      : previewMatches
        ? "ready"
        : "loading";
  const status = snapshot?.session.status ?? (previewMatches ? preview?.status : undefined);
  const phase = !joined ? previewPhase : participants.phase === "idle" ? "loading" : participants.phase;

  return {
    phase,
    snapshot,
    preview: previewMatches ? preview : null,
    error: actionError ?? (failedHere?.code === "error" ? failedHere.message : null) ?? participants.error,
    isMember: joined,
    isCreator: Boolean(snapshot?.isCreator || readCreatorToken(sessionId)),
    ended: sessionEnded(status),
    join,
    updateLocation: (fix: LocationFix) => run(() => repository.updateLocation(sessionId, fix)),
    stopSharing: () => run(() => repository.stopSharing(sessionId)),
    endSession: () => run(() => repository.endSession(sessionId)),
    leaveSession: () => run(() => repository.leaveSession(sessionId)),
    heartbeat: () => repository.heartbeat(sessionId),
    refresh: participants.refresh,
  };
}
