"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SessionError } from "@/lib/data/errors";
import { readMembership } from "@/lib/data/membership";
import { repository } from "@/lib/data/repository";
import type { SessionSnapshot } from "@/lib/data/types";

function preferNewer(current: SessionSnapshot | null, next: SessionSnapshot) {
  if (!current) return next;
  if (Date.parse(next.revision) < Date.parse(current.revision)) return current;
  return {
    ...next,
    selfId: next.selfId ?? current.selfId,
    isCreator: next.selfId ? next.isCreator : current.isCreator,
  };
}

export function useParticipants(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const snapshotRef = useRef<SessionSnapshot | null>(null);

  const apply = useCallback((next: SessionSnapshot | null) => {
    if (!next) {
      snapshotRef.current = null;
      setSnapshot(null);
      setMissing(true);
      return;
    }
    const merged = preferNewer(snapshotRef.current, next);
    snapshotRef.current = merged;
    setSnapshot(merged);
    setMissing(false);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) return null;
    const next = await repository.load(sessionId);
    apply(next);
    return next;
  }, [apply, sessionId]);

  useEffect(() => {
    if (!sessionId || !readMembership(sessionId)) return;

    let cancelled = false;
    const unsub = repository.subscribe(sessionId, (next) => {
      if (!cancelled) apply(next);
    });

    void repository
      .load(sessionId)
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        if (failure instanceof SessionError && failure.code === "missing") {
          apply(null);
          return;
        }
        setError(failure instanceof SessionError ? failure.message : "Something went wrong. Try again.");
      });

    const poll = window.setInterval(() => {
      void repository
        .load(sessionId)
        .then((next) => {
          if (!cancelled && next) apply(next);
        })
        .catch(() => {});
    }, 12000);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(poll);
    };
  }, [apply, sessionId]);

  const active = Boolean(sessionId && readMembership(sessionId));
  const phase = !active ? "idle" : missing ? "missing" : error ? "error" : snapshot ? "ready" : "loading";

  return {
    snapshot: active ? snapshot : null,
    phase,
    error,
    refresh,
    apply,
  } as const;
}
