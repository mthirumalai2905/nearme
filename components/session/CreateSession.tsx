"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Share } from "lucide-react";
import { Appear } from "@/components/motion/Appear";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { messageFrom } from "@/lib/data/errors";
import { repository } from "@/lib/data/repository";
import { shareUrl } from "@/lib/session/ids";
import { formatTimeLeft } from "@/lib/session/time";

let createLock = false;

export function CreateSession() {
  const started = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    () => () => {},
    () => typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    if (started.current || createLock) return;
    started.current = true;
    createLock = true;
    void repository
      .createSession()
      .then((session) => {
        setSessionId(session.sessionId);
        setExpiresAt(session.expiresAt);
      })
      .catch((failure: unknown) => setError(messageFrom(failure)));
  }, []);

  const url = sessionId ? shareUrl(sessionId) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Near Me", text: "Join me on Near Me.", url });
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setError("The link couldn't be shared. Copy it instead.");
    }
  }

  return (
    <div className="relative min-h-dvh">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero-landscape.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="relative min-h-dvh">
      <Appear className="absolute inset-x-0 top-0 z-20" y={-12} delay={0.05}>
        <SiteHeader />
      </Appear>
      <main id="content" className="absolute inset-0 flex items-center justify-center px-5">
        <Appear className="w-full max-w-[440px]" y={28} delay={0.16}>
        <div className="overflow-hidden rounded-[14px] border border-white/70 bg-[#f5f5f7] text-[#1d1d1f] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
          <div className="relative flex h-11 items-center border-b border-black/10 bg-white/90 px-3.5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <p className="pointer-events-none absolute inset-x-0 text-center text-[13px] font-medium">Near Me</p>
          </div>
          <div className="px-6 py-7 sm:px-8">
        {!sessionId && !error ? (
          <p className="text-[22px] font-semibold tracking-tight" role="status">
            Creating your session...
          </p>
        ) : null}
        {error ? (
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Something went wrong.</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">{error}</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : null}
        {sessionId && expiresAt ? (
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#0071e3] uppercase">Session</p>
            <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight">Your session is ready</h1>
            <p className="mt-1.5 text-[15px] text-[#6e6e73]">Share this link with your friends.</p>
            <p className="mt-6 text-center font-mono text-[26px] tracking-[0.18em]">{sessionId}</p>
            <label className="mt-5 block text-[12px] font-medium text-[#6e6e73]" htmlFor="share-link">
              Session link
            </label>
            <input
              id="share-link"
              readOnly
              value={url}
              className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[14px] text-[#1d1d1f]"
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="mt-2 text-[13px] text-[#6e6e73]">{formatTimeLeft(expiresAt)}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="sm" pill onClick={() => void copy()}>
                {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
                {copied ? "Link copied" : "Copy link"}
              </Button>
              {canShare ? (
                <Button size="sm" pill variant="secondary" onClick={() => void share()}>
                  <Share size={16} strokeWidth={1.75} />
                  Share
                </Button>
              ) : null}
              <ButtonLink href={`/session/${sessionId}`} variant="secondary" size="sm" pill>
                Open map
              </ButtonLink>
            </div>
            <p className="sr-only" aria-live="polite">
              {copied ? "Link copied" : ""}
            </p>
          </div>
        ) : null}
          </div>
        </div>
        </Appear>
      </main>
      </div>
    </div>
  );
}
