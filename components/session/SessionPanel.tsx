"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { MeetPanel, type MeetPerson } from "@/components/meeting/MeetPanel";
import type { MeetPath } from "@/lib/meeting/plan";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type PersonRow = {
  id: string;
  name: string;
  subtitle: string;
  isYou: boolean;
  avatar: string;
};

export function SessionPanel({
  count,
  referenceLabel,
  rows,
  selectedId,
  onSelect,
  summary,
  detail,
  empty,
  shareUrl,
  notice,
  sharing,
  onShare,
  onStop,
  isCreator,
  onEnd,
  meetPeople,
  onPlace,
}: {
  count: number;
  referenceLabel?: string | null;
  rows: PersonRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  summary: string | null;
  detail: string | null;
  empty: boolean;
  shareUrl: string;
  notice: string | null;
  sharing: boolean;
  onShare: () => void;
  onStop: () => void;
  isCreator: boolean;
  onEnd: () => Promise<void>;
  meetPeople: MeetPerson[];
  onPlace: (plan: { place: { id: string; name: string; latitude: number; longitude: number; image: string | null }; paths: MeetPath[] } | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [meetOpen, setMeetOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <p className="text-[20px] font-semibold tracking-tight">
        {count} {count === 1 ? "person" : "people"}
      </p>
      {referenceLabel ? <p className="mt-1 text-[13px] text-muted">{referenceLabel}</p> : null}
      {empty ? (
        <div className="mt-5">
          {rows.filter((person) => person.isYou).map((person) => (
            <div key={person.id} className="mb-5 flex items-center justify-between gap-3">
              <span>
                <span className="block text-[17px]">{person.name}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{person.subtitle}</span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={person.avatar} alt="" className={cn("nm-avatar", "is-you")} />
            </div>
          ))}
          <h2 className="text-[22px] font-semibold tracking-tight">No one else has joined yet.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Share your link to bring your friends onto the map.
          </p>
          <Button className="mt-5" size="md" onClick={() => void copy()}>
            {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
            {copied ? "Link copied" : "Copy link"}
          </Button>
        </div>
      ) : (
        <ul className="mt-2">
          {rows.map((person) => (
            <li key={person.id} className="border-b border-line">
              <button
                type="button"
                aria-pressed={selectedId === person.id}
                onClick={() => onSelect(person.id)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span>
                  <span className="block text-[17px]">{person.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{person.subtitle}</span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={person.avatar}
                  alt=""
                  className={cn("nm-avatar", person.isYou && "is-you")}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {summary ? <p className="mt-4 text-[15px]">{summary}</p> : null}
      {detail ? <p className="text-[13px] text-muted">{detail}</p> : null}
      {notice ? <p className="mt-4 text-[15px] text-muted">{notice}</p> : null}
      <div className="mt-5 flex flex-col items-start gap-2">
        {!empty ? (
          <Button variant="ghost" size="md" className="px-0" onClick={() => void copy()}>
            {copied ? "Link copied" : "Copy link"}
          </Button>
        ) : null}
        {sharing ? (
          <Button variant="ghost" size="md" className="px-0" onClick={onStop}>
            Stop sharing location
          </Button>
        ) : (
          <Button variant="ghost" size="md" className="px-0" onClick={onShare}>
            Share location
          </Button>
        )}
        <Button variant="secondary" size="md" onClick={() => setMeetOpen((open) => !open)}>
          Find somewhere to meet
        </Button>
      </div>
      {meetOpen ? (
        <div className="mt-5 border-t border-line pt-5">
          <MeetPanel people={meetPeople} onPlace={onPlace} />
        </div>
      ) : null}
      {isCreator ? (
        <div className="mt-8 border-t border-line pt-4">
          {confirmEnd ? (
            <div>
              <p className="text-[15px]">End this session for everyone?</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  size="md"
                  disabled={ending}
                  onClick={() => {
                    setEnding(true);
                    void onEnd().finally(() => setEnding(false));
                  }}
                >
                  {ending ? "Ending..." : "End session"}
                </Button>
                <Button variant="secondary" size="md" onClick={() => setConfirmEnd(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" size="md" className="px-0" onClick={() => setConfirmEnd(true)}>
              End session
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
