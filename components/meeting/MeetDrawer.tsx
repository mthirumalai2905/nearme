"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { X } from "lucide-react";
import type { ScoredPlace } from "@/lib/meeting/fairness";
import type { MeetPath, MeetPlan } from "@/lib/meeting/plan";
import { repository, type MeetLike, type MeetNote } from "@/lib/data/repository";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type MeetPerson = {
  name: string;
  latitude: number;
  longitude: number;
};

const PLACE_IDEAS = ["Nearest cafe", "Nearest restaurant", "A nearby place"];
const STAR_CHOICES = [5, 4, 3, 0];
const BUDGET_CHOICES = [500, 1000, 3000, 0];

function rupee(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function PlacePhoto({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [photo, setPhoto] = useState(src?.startsWith("https://") ? src : "");
  useEffect(() => {
    setPhoto(src?.startsWith("https://") ? src : "");
  }, [src]);
  if (!photo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={alt} onError={() => setPhoto("")} className={className} />
  );
}

export function MeetDrawer({
  open,
  people,
  feedback,
  matchedName,
  sessionId,
  voterName,
  onClose,
  onMatch,
  onFeedback,
}: {
  open: boolean;
  people: MeetPerson[];
  feedback: boolean;
  matchedName: string | null;
  sessionId: string;
  voterName: string;
  onClose: () => void;
  onMatch: (plan: MeetPlan) => void;
  onFeedback: () => void;
}) {
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState("Nearest cafe");
  const [stars, setStars] = useState(5);
  const [budget, setBudget] = useState(3000);
  const [customBudget, setCustomBudget] = useState("");
  const [places, setPlaces] = useState<ScoredPlace[]>([]);
  const [yeses, setYeses] = useState<ScoredPlace[]>([]);
  const [notes, setNotes] = useState<MeetNote[]>([]);
  const [draft, setDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [opened, setOpened] = useState<ScoredPlace | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "routing" | "empty" | "error" | "match">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [again, setAgain] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const choosing = useRef(false);
  const picked = useRef(new Set<string>());
  const onRemoteLike = useRef<(like: MeetLike) => void>(() => undefined);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(`nearme.shortlist.${sessionId}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ScoredPlace[];
      if (Array.isArray(parsed)) setYeses(parsed.filter((place) => place && typeof place.id === "string"));
    } catch {
      window.sessionStorage.removeItem(`nearme.shortlist.${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    window.sessionStorage.setItem(`nearme.shortlist.${sessionId}`, JSON.stringify(yeses));
  }, [sessionId, yeses]);

  useEffect(() => {
    picked.current = new Set(yeses.map((place) => place.id));
  }, [yeses]);

  useEffect(() => {
    return repository.subscribeNotes(sessionId, (note) => {
      setNotes((current) => (current.some((item) => item.id === note.id) ? current : [...current, note]));
    });
  }, [sessionId]);

  useEffect(() => {
    return repository.subscribeLikes(sessionId, (like) => onRemoteLike.current(like));
  }, [sessionId]);

  const budgetValue = customBudget.trim() ? Number(customBudget) : budget;

  async function find() {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          people,
          stars: stars || null,
          budget: Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null,
        }),
      });
      const body = (await response.json()) as { places?: ScoredPlace[]; message?: string };
      if (!response.ok) {
        setStatus("error");
        setError(body.message || "We couldn't look up places just now. Try again in a moment.");
        return;
      }
      const next = body.places ?? [];
      setPlaces(next);
      setYeses([]);
      setReviewing(false);
      setOpened(null);
      setIndex(0);
      setStep(3);
      setStatus(next.length ? "idle" : "empty");
    } catch {
      setStatus("error");
      setError("We couldn't look up places just now. Try again in a moment.");
    }
  }

  function shareLike(next: ScoredPlace) {
    repository.publishLike(sessionId, {
      id: next.id,
      name: next.name,
      latitude: next.latitude,
      longitude: next.longitude,
      image: next.image,
      category: next.category,
      address: next.address,
      by: voterName,
    });
  }

  function keep(next: ScoredPlace) {
    if (picked.current.has(next.id)) return;
    picked.current.add(next.id);
    setYeses((current) => (current.some((place) => place.id === next.id) ? current : [...current, next]));
  }

  function choose(next: ScoredPlace, yes: boolean) {
    if (!yes) {
      setIndex((value) => value + 1);
      return;
    }
    if (picked.current.has(next.id)) {
      shareLike(next);
      void confirm(next);
      return;
    }
    keep(next);
    shareLike(next);
    setIndex((value) => value + 1);
  }

  onRemoteLike.current = (like) => {
    const next: ScoredPlace = {
      id: like.id,
      name: like.name,
      latitude: like.latitude,
      longitude: like.longitude,
      category: like.category,
      address: like.address,
      hours: null,
      image: like.image,
      travel: [],
      why: `${like.by} likes this.`,
      score: 0,
    };
    if (picked.current.has(next.id)) {
      void confirm(next);
      return;
    }
    keep(next);
  };

  async function confirm(next: ScoredPlace) {
    if (choosing.current) return;
    choosing.current = true;
    setStatus("routing");
    setError(null);
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place: { latitude: next.latitude, longitude: next.longitude },
          people,
        }),
      });
      const body = (await response.json()) as { paths?: MeetPath[]; message?: string };
      if (!response.ok) {
        setStatus("error");
        setError(body.message || "We couldn't draw a walking route just now.");
        return;
      }
      onMatch({
        place: {
          id: next.id,
          name: next.name,
          latitude: next.latitude,
          longitude: next.longitude,
          image: next.image,
        },
        paths: body.paths ?? [],
      });
      setStatus("match");
    } catch {
      setStatus("error");
      setError("We couldn't draw a walking route just now.");
    } finally {
      choosing.current = false;
    }
  }

  function finalize(next: ScoredPlace) {
    const dest = `${next.latitude},${next.longitude}`;
    const name = encodeURIComponent(next.name);
    const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = apple
      ? `https://maps.apple.com/?daddr=${dest}&q=${name}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
    void confirm(next);
    window.location.assign(url);
  }

  if (!open) return null;

  return (
    <aside className="glass absolute top-20 right-4 bottom-6 z-40 flex w-[min(380px,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl border border-line text-ink max-md:inset-x-0 max-md:top-16 max-md:bottom-0 max-md:w-full max-md:rounded-b-none max-md:rounded-t-3xl">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.04em] text-accent uppercase">Suggestions</p>
          <h2 className="text-[22px] font-semibold tracking-tight">{feedback ? "How was it?" : "Find a place"}</h2>
        </div>
        <button type="button" aria-label="Close suggestions" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-line">
          <X size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {feedback ? (
          <FeedbackForm
            name={matchedName}
            rating={rating}
            again={again}
            note={note}
            sent={sent}
            onRating={setRating}
            onAgain={setAgain}
            onNote={setNote}
            onSubmit={() => {
              if (again === null) return;
              setSent(true);
              onFeedback();
            }}
          />
        ) : status === "match" ? (
          <div className="pt-6">
            <p className="text-[13px] font-semibold tracking-[0.04em] text-[#248a3d] uppercase">It's a match</p>
            <h3 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight">{matchedName}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">
              The green line is the walk. Everyone in this session can see it. When you arrive, I'll ask how it went.
            </p>
            <Button className="mt-6" size="md" onClick={onClose}>
              Watch the map
            </Button>
          </div>
        ) : step >= 3 && opened ? (
          <CafeDetail
            place={opened}
            budget={Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null}
            routing={status === "routing"}
            error={error}
            onBack={() => setOpened(null)}
            onFinal={() => finalize(opened)}
          />
        ) : step >= 3 ? (
          <CafeList
            places={places}
            budget={Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null}
            empty={status === "empty"}
            error={error}
            onOpen={setOpened}
          />
        ) : (
          <QuestionStep
            step={step}
            prompt={prompt}
            stars={stars}
            budget={budget}
            customBudget={customBudget}
            people={people.length}
            loading={status === "loading"}
            error={error}
            onPrompt={setPrompt}
            onStars={setStars}
            onBudget={(value) => {
              setBudget(value);
              setCustomBudget("");
            }}
            onCustomBudget={setCustomBudget}
            onBack={() => setStep((value) => Math.max(0, value - 1))}
            onNext={() => {
              if (step < 2) setStep((value) => value + 1);
              else void find();
            }}
          />
        )}
      </div>
    </aside>
  );
}

function budgetLabel(budget: number | null) {
  return budget ? `${rupee(budget)} per person` : "No budget limit";
}

function CafeList({
  places,
  budget,
  empty,
  error,
  onOpen,
}: {
  places: ScoredPlace[];
  budget: number | null;
  empty: boolean;
  error: string | null;
  onOpen: (place: ScoredPlace) => void;
}) {
  if (empty || places.length === 0) {
    return (
      <div className="pt-6">
        <h3 className="text-[28px] font-semibold tracking-tight">Nothing nearby matched.</h3>
        <p className="mt-2 text-[15px] text-muted">Try a different place or budget.</p>
        {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      </div>
    );
  }
  return (
    <div>
      <p className="text-[15px] text-muted">Budget {budgetLabel(budget)}. Open a cafe to see more.</p>
      <ul className="mt-4 space-y-3">
        {places.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => onOpen(place)} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left">
              <PlacePhoto src={place.image} alt={place.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{place.name}</span>
                <span className="mt-1 block truncate text-[13px] text-muted">{place.address ?? place.category}</span>
                <span className="mt-1 block text-[14px]">{budgetLabel(budget)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CafeDetail({
  place,
  budget,
  routing,
  error,
  onBack,
  onFinal,
}: {
  place: ScoredPlace;
  budget: number | null;
  routing: boolean;
  error: string | null;
  onBack: () => void;
  onFinal: () => void;
}) {
  return (
    <div>
      <button type="button" onClick={onBack} className="text-[15px] font-medium text-accent">
        Back to list
      </button>
      <PlacePhoto src={place.image} alt={place.name} className="mt-4 h-52 w-full rounded-2xl object-cover" />
      <h3 className="mt-4 text-[28px] leading-tight font-semibold tracking-tight">{place.name}</h3>
      <p className="mt-1 text-[15px] text-muted">{place.category}</p>
      {place.address ? <p className="mt-2 text-[15px] text-muted">{place.address}</p> : null}
      <p className="mt-3 text-[16px]">Budget {budgetLabel(budget)}</p>
      {typeof place.stars === "number" ? <p className="mt-1 text-[15px] text-muted">{place.stars} star on the map</p> : <p className="mt-1 text-[15px] text-muted">Rating isn't listed.</p>}
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{place.why}</p>
      {place.travel.length > 0 ? (
        <p className="mt-3 text-[14px] text-muted">{place.travel.map((leg) => `${leg.minutes} min from ${leg.name}`).join(" · ")}</p>
      ) : null}
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      <Button className="mt-6 w-full" size="md" onClick={onFinal} disabled={routing}>
        {routing ? "Opening maps..." : "Final this cafe"}
      </Button>
    </div>
  );
}

function QuestionStep({
  step,
  prompt,
  stars,
  budget,
  customBudget,
  people,
  loading,
  error,
  onPrompt,
  onStars,
  onBudget,
  onCustomBudget,
  onBack,
  onNext,
}: {
  step: number;
  prompt: string;
  stars: number;
  budget: number;
  customBudget: string;
  people: number;
  loading: boolean;
  error: string | null;
  onPrompt: (value: string) => void;
  onStars: (value: number) => void;
  onBudget: (value: number) => void;
  onCustomBudget: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const asks = [
    "What kind of place should I look for?",
    "Do you want a minimum rating? For example, 5 star.",
    "What's the budget per person? For example, ₹3,000.",
  ];
  return (
    <div className="pt-2">
      <div className="rounded-2xl bg-surface px-4 py-3 text-[16px] leading-relaxed">{asks[step]}</div>
      {people < 1 ? <p className="mt-4 text-[14px] text-muted">Share your location first, then I can look nearby.</p> : null}
      {step === 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {PLACE_IDEAS.map((item) => (
              <Chip key={item} pressed={prompt === item} onClick={() => onPrompt(item)}>
                {item}
              </Chip>
            ))}
          </div>
          <input
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            placeholder="Nearest cafe, restaurant, park..."
            className="mt-3 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[16px]"
          />
        </div>
      ) : null}
      {step === 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {STAR_CHOICES.map((item) => (
            <Chip key={item} pressed={stars === item} onClick={() => onStars(item)}>
              {item === 0 ? "No preference" : `${item} star`}
            </Chip>
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {BUDGET_CHOICES.map((item) => (
              <Chip key={item} pressed={!customBudget && budget === item} onClick={() => onBudget(item)}>
                {item === 0 ? "No limit" : rupee(item)}
              </Chip>
            ))}
          </div>
          <input
            value={customBudget}
            onChange={(event) => onCustomBudget(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="Or type an amount"
            className="mt-3 h-11 w-full rounded-xl border border-line bg-bg px-3 text-[16px]"
          />
          <p className="mt-3 text-[13px] leading-5 text-muted">
            Most places don't publish a price or a star rating. I'll use what you asked for, and I'll only show a rating when the map lists one.
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      <div className="mt-6 flex gap-2">
        {step > 0 ? (
          <Button variant="secondary" size="md" onClick={onBack}>
            Back
          </Button>
        ) : null}
        <Button size="md" onClick={onNext} disabled={loading || people < 1 || (step === 0 && prompt.trim().length === 0)}>
          {loading ? "Looking..." : step === 2 ? "Show places" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function CardStep({
  place,
  spent,
  empty,
  routing,
  error,
  stars,
  budget,
  yesCount,
  onReview,
  onNo,
  onYes,
}: {
  place: ScoredPlace | undefined;
  spent: boolean;
  empty: boolean;
  routing: boolean;
  error: string | null;
  stars: number;
  budget: number | null;
  yesCount: number;
  onReview: () => void;
  onNo: () => void;
  onYes: () => void;
}) {
  if (empty || spent || !place) {
    return (
      <div className="pt-8">
        <h3 className="text-[28px] font-semibold tracking-tight">{empty ? "Nothing nearby matched." : "That's every suggestion."}</h3>
        <p className="mt-2 text-[15px] text-muted">No places selected.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] text-muted">Swipe right for yes, left for no. {yesCount} yes so far.</p>
      <SwipeCard place={place} stars={stars} budget={budget} onNo={onNo} onYes={onYes} />
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="md" onClick={onNo} disabled={routing}>
          No
        </Button>
        <Button size="md" onClick={onYes} disabled={routing}>
          Yes
        </Button>
      </div>
      {yesCount > 0 ? (
        <Button className="mt-3" variant="secondary" size="md" onClick={onReview}>
          See {yesCount} selected
        </Button>
      ) : null}
    </div>
  );
}

function Shortlist({
  yeses,
  notes,
  draft,
  routing,
  error,
  onDraft,
  onSend,
  onLike,
  onBack,
}: {
  yeses: ScoredPlace[];
  notes: MeetNote[];
  draft: string;
  routing: boolean;
  error: string | null;
  onDraft: (value: string) => void;
  onSend: () => void;
  onLike: (place: ScoredPlace) => void;
  onBack: (() => void) | null;
}) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-muted">
        These are the places with a yes. One more like on a place locks it in.
      </p>
      <ul className="mt-4 space-y-3">
        {yeses.map((place) => (
          <li key={place.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <PlacePhoto src={place.image} alt={place.name} className="h-14 w-14 rounded-xl object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{place.name}</span>
              <span className="block truncate text-[13px] text-muted">{place.address ?? place.category}</span>
            </span>
            <Button size="sm" onClick={() => onLike(place)} disabled={routing}>
              {routing ? "..." : "Like"}
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-2xl bg-surface p-3">
        <p className="text-[13px] font-semibold tracking-[0.04em] uppercase text-muted">Chat</p>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
          {notes.length === 0 ? <p className="text-[14px] text-muted">No messages yet.</p> : null}
          {notes.map((note) => (
            <p key={note.id} className="text-[14px] leading-5">
              <span className="font-medium">{note.name}</span> {note.text}
            </p>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <input
            value={draft}
            onChange={(event) => onDraft(event.target.value.slice(0, 240))}
            placeholder="Say which one you prefer"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-[14px]"
          />
          <Button size="sm" type="submit">
            Send
          </Button>
        </form>
      </div>
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      {onBack ? (
        <Button className="mt-4" variant="secondary" size="md" onClick={onBack}>
          Keep swiping
        </Button>
      ) : null}
    </div>
  );
}

function SwipeCard({
  place,
  stars,
  budget,
  onNo,
  onYes,
}: {
  place: ScoredPlace;
  stars: number;
  budget: number | null;
  onNo: () => void;
  onYes: () => void;
}) {
  const x = useMotionValue(0);
  const yesOpacity = useTransform(x, [40, 140], [0, 1]);
  const noOpacity = useTransform(x, [-140, -40], [1, 0]);
  const listed = typeof place.stars === "number";
  return (
    <motion.article
      key={place.id}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) onYes();
        else if (info.offset.x < -110) onNo();
      }}
      className="relative mt-3 overflow-hidden rounded-[28px] border border-line bg-surface"
    >
      <motion.span style={{ opacity: yesOpacity }} className="absolute top-4 left-4 z-10 rounded-full bg-[#248a3d] px-3 py-1 text-[13px] font-semibold text-white">
        Yes
      </motion.span>
      <motion.span style={{ opacity: noOpacity }} className="absolute top-4 right-4 z-10 rounded-full bg-[#d92d20] px-3 py-1 text-[13px] font-semibold text-white">
        No
      </motion.span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <PlacePhoto src={place.image} alt={place.name} className="h-52 w-full object-cover" />
      <div className="p-4">
        <h3 className="text-[26px] leading-tight font-semibold tracking-tight">{place.name}</h3>
        <p className="mt-1 text-[14px] text-muted">{place.category}</p>
        {place.address ? <p className="mt-2 text-[14px] text-muted">{place.address}</p> : null}
        <p className="mt-3 text-[14px]">
          {listed ? `${place.stars} star on the map` : stars ? `${stars} star was requested. Rating isn't listed.` : "No rating listed."}
        </p>
        {budget ? <p className="mt-1 text-[14px] text-muted">Your budget is {rupee(budget)} per person. Price isn't listed.</p> : null}
        <p className="mt-3 text-[14px] leading-relaxed text-muted">{place.why}</p>
        <p className="mt-3 text-[14px] tabular-nums text-muted">
          {place.travel.map((leg) => `${leg.minutes} min from ${leg.name}`).join(" · ")}
        </p>
      </div>
    </motion.article>
  );
}

function FeedbackForm({
  name,
  rating,
  again,
  note,
  sent,
  onRating,
  onAgain,
  onNote,
  onSubmit,
}: {
  name: string | null;
  rating: number;
  again: boolean | null;
  note: string;
  sent: boolean;
  onRating: (value: number) => void;
  onAgain: (value: boolean) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
}) {
  if (sent) {
    return <p className="pt-6 text-[18px] leading-relaxed">Thanks. That helps the next time you meet.</p>;
  }
  return (
    <div className="pt-2">
      <p className="text-[16px] leading-relaxed text-muted">You made it to {name ?? "the place"}. How did it go?</p>
      <div className="mt-5 flex gap-2" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rating === value}
            onClick={() => onRating(value)}
            className={cn(
              "h-11 w-11 rounded-full border text-[15px] font-semibold",
              rating === value ? "border-ink bg-ink text-bg" : "border-line",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="mt-5 text-[15px]">Would you meet here again?</p>
      <div className="mt-2 flex gap-2">
        <Chip pressed={again === true} onClick={() => onAgain(true)}>
          Yes
        </Chip>
        <Chip pressed={again === false} onClick={() => onAgain(false)}>
          No
        </Chip>
      </div>
      <textarea
        value={note}
        onChange={(event) => onNote(event.target.value.slice(0, 240))}
        placeholder="Anything else?"
        className="mt-4 h-24 w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[15px]"
      />
      <Button className="mt-4" size="md" onClick={onSubmit} disabled={again === null}>
        Send feedback
      </Button>
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full border px-3.5 text-[14px]",
        pressed ? "border-ink bg-ink text-bg" : "border-line bg-bg text-ink",
      )}
    >
      {children}
    </button>
  );
}
