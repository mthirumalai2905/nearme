"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Drop = { latitude: number; longitude: number; at: number };

export function BetaTester({
  sessionId,
  placing,
  drop,
  onPlacing,
}: {
  sessionId: string;
  placing: boolean;
  drop: Drop | null;
  onPlacing: (placing: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("Alex");
  const [token, setToken] = useState("");
  const [spot, setSpot] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`nearme.beta.${sessionId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { token?: string; name?: string; latitude?: number; longitude?: number };
      if (parsed.token) setToken(parsed.token);
      if (parsed.name) setName(parsed.name);
      if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
        setSpot({ latitude: parsed.latitude, longitude: parsed.longitude });
      }
    } catch {
      window.sessionStorage.removeItem(`nearme.beta.${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!drop || !unlocked) return;
    void place(drop.latitude, drop.longitude);
    // place is recreated each render; this effect should run only when a new map click arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop?.at]);

  useEffect(() => {
    if (!unlocked || !token || !spot) return;
    const timer = window.setInterval(() => {
      void send("place", spot);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [unlocked, token, spot, password, sessionId, name]);

  function remember(nextToken: string, nextSpot: { latitude: number; longitude: number }) {
    setToken(nextToken);
    setSpot(nextSpot);
    window.sessionStorage.setItem(
      `nearme.beta.${sessionId}`,
      JSON.stringify({ token: nextToken, name, latitude: nextSpot.latitude, longitude: nextSpot.longitude }),
    );
  }

  async function send(action: "unlock" | "place" | "remove", point?: { latitude: number; longitude: number }) {
    const response = await fetch("/api/beta/tester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        action,
        sessionId,
        name,
        testerToken: token || undefined,
        latitude: point?.latitude,
        longitude: point?.longitude,
      }),
    });
    const body = (await response.json()) as { ok?: boolean; message?: string; testerToken?: string };
    if (!response.ok) throw new Error(body.message || "That didn't work. Try again.");
    return body;
  }

  async function unlock() {
    setStatus("working");
    setMessage(null);
    try {
      await send("unlock");
      setUnlocked(true);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That password isn't right.");
    }
  }

  async function place(latitude: number, longitude: number) {
    setStatus("working");
    setMessage(null);
    try {
      const body = await send("place", { latitude, longitude });
      if (body.testerToken) remember(body.testerToken, { latitude, longitude });
      onPlacing(false);
      setStatus("idle");
      setMessage("Test person is on the map.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That didn't work. Try again.");
    }
  }

  async function remove() {
    setStatus("working");
    setMessage(null);
    try {
      if (token) await send("remove");
      window.sessionStorage.removeItem(`nearme.beta.${sessionId}`);
      setToken("");
      setSpot(null);
      onPlacing(false);
      setStatus("idle");
      setMessage("Test person removed.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That didn't work. Try again.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((value) => !value)} className="glass rounded-full border border-line px-3 py-1.5 text-[13px]">
        Beta
      </button>
      {open ? (
        <div className="glass absolute top-14 right-0 w-[280px] rounded-2xl border border-line p-4 text-left">
          <p className="text-[15px] font-semibold tracking-tight">Test person</p>
          <p className="mt-1 text-[13px] leading-5 text-muted">Only for trying the session. Everyone else still joins with a link.</p>
          {unlocked ? (
            <div className="mt-3">
              <label className="block text-[13px] text-muted">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 32))}
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-bg px-3 text-[15px] text-ink"
                />
              </label>
              <Button className="mt-3" size="sm" onClick={() => onPlacing(!placing)} disabled={status === "working" || name.trim().length === 0}>
                {placing ? "Click the map..." : token ? "Move them" : "Place on map"}
              </Button>
              {token ? (
                <Button className="mt-2" variant="secondary" size="sm" onClick={() => void remove()} disabled={status === "working"}>
                  Remove
                </Button>
              ) : null}
            </div>
          ) : (
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void unlock();
              }}
            >
              <label className="block text-[13px] text-muted">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-bg px-3 text-[15px] text-ink"
                />
              </label>
              <Button className="mt-3" size="sm" type="submit" disabled={status === "working" || password.length === 0}>
                {status === "working" ? "Checking..." : "Unlock"}
              </Button>
            </form>
          )}
          {message ? <p className="mt-3 text-[13px] text-muted">{message}</p> : null}
        </div>
      ) : null}
    </>
  );
}
