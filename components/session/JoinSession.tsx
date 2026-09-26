"use client";

import { useEffect, useState } from "react";
import { MacStage } from "@/components/layout/MacStage";
import { JoinForm } from "@/components/session/JoinForm";
import { ButtonLink } from "@/components/ui/Button";
import { messageFrom, SessionError } from "@/lib/data/errors";
import { hasMembership } from "@/lib/data/membership";
import { repository, sessionEnded } from "@/lib/data/repository";
import { useRouter } from "next/navigation";

export function JoinSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "ended" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasMembership(sessionId)) {
      router.replace(`/session/${sessionId}`);
      return;
    }
    let cancelled = false;
    void repository
      .preview(sessionId)
      .then((session) => {
        if (cancelled) return;
        setPhase(sessionEnded(session.status) ? "ended" : "ready");
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        if (failure instanceof SessionError && failure.code === "missing") {
          setPhase("missing");
          return;
        }
        setPhase("error");
        setError(messageFrom(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  return (
    <MacStage>
      {phase === "loading" ? <p className="text-[22px] font-semibold tracking-tight">Finding the session...</p> : null}
      {phase === "missing" ? (
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">This session doesn’t exist.</h1>
          <ButtonLink href="/create" size="sm" pill className="mt-6">
            Create a session
          </ButtonLink>
        </div>
      ) : null}
      {phase === "ended" ? (
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">This session has ended.</h1>
          <p className="mt-2 text-[15px] text-[#6e6e73]">Ask the person who created it for a new link.</p>
        </div>
      ) : null}
      {phase === "error" ? (
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Something went wrong.</h1>
          <p className="mt-2 text-[15px] text-[#6e6e73]">{error}</p>
        </div>
      ) : null}
      {phase === "ready" ? <JoinForm sessionId={sessionId} embedded /> : null}
    </MacStage>
  );
}
