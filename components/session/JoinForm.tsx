"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { messageFrom } from "@/lib/data/errors";
import { readCreatorToken } from "@/lib/data/membership";
import { repository } from "@/lib/data/repository";
import { parseSessionInput } from "@/lib/session/ids";

export function JoinEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const sessionId = parseSessionInput(value);
    if (!sessionId) {
      setError("That link doesn't look right.");
      return;
    }
    router.push(`/join/${sessionId}`);
  }

  return (
    <form onSubmit={submit} className="mt-10 max-w-md">
      <TextField
        label="Session link or code"
        name="session"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nearme.app/join/..."
      />
      {error ? (
        <p className="mt-3 text-[15px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-6">
        Continue
      </Button>
    </form>
  );
}

export function JoinForm({
  sessionId,
  onJoined,
  join,
  embedded = false,
}: {
  sessionId: string;
  onJoined?: () => void;
  join?: (displayName: string) => Promise<unknown>;
  embedded?: boolean;
}) {
  const router = useRouter();
  const creator = useSyncExternalStore(
    () => () => {},
    () => Boolean(readCreatorToken(sessionId)),
    () => false,
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (join) await join(name);
      else await repository.join(sessionId, name);
      if (onJoined) onJoined();
      else router.push(`/session/${sessionId}`);
    } catch (failure) {
      setError(messageFrom(failure));
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className={embedded ? "" : "mt-10 max-w-md"}>
      <h1 className={embedded ? "text-[28px] leading-tight font-semibold tracking-tight text-[#1d1d1f]" : "text-[40px] leading-tight font-semibold tracking-tight"}>
        {creator ? "Your name" : "Join Near Me"}
      </h1>
      <p className={embedded ? "mt-1.5 text-[15px] text-[#6e6e73]" : "mt-3 text-[18px] text-muted"}>
        {creator ? "This is how you'll appear on the map." : "You'll show up on the map with this name."}
      </p>
      <div className={embedded ? "mt-6" : "mt-8"}>
        <TextField
          label="Your name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="nickname"
          maxLength={32}
          required
        />
      </div>
      {error ? (
        <p className="mt-3 text-[15px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size={embedded ? "sm" : "lg"} pill={embedded} className="mt-6" disabled={pending || name.trim().length === 0}>
        {pending ? "Joining..." : creator ? "Continue" : "Join session"}
      </Button>
    </form>
  );
}
