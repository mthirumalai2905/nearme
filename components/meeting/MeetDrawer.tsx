"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { X } from "lucide-react";
import type { ScoredPlace } from "@/lib/meeting/fairness";
import type { MeetPath, MeetPlan } from "@/lib/meeting/plan";
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

function fallbackImage(category: string) {
  const key = category.toLowerCase();
  if (key.includes("cafe")) return "/places/cafe.svg";
  if (key.includes("restaurant")) return "/places/restaurant.svg";
  if (key.includes("park")) return "/places/park.svg";
  return "/places/place.svg";
}

export function MeetDrawer({
  open,
  people,
  feedback,
  matchedName,
  onClose,
  onMatch,
  onFeedback,
}: {
  open: boolean;
  people: MeetPerson[];
  feedback: boolean;
  matchedName: string | null;
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
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "routing" | "empty" | "error" | "match">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [again, setAgain] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const choosing = useRef(false);

  const place = places[index];
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
      setIndex(0);
      setStep(3);
      setStatus(next.length ? "idle" : "empty");
    } catch {
      setStatus("error");
      setError("We couldn't look up places just now. Try again in a moment.");
    }
  }

  async function choose(next: ScoredPlace, yes: boolean) {
    if (choosing.current) return;
    if (!yes) {
      setIndex((value) => value + 1);
      return;
    }
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

  if (!open) return null;

  return (
    <aside className="fixed top-0 right-0 z-40 flex h-dvh w-full max-w-[420px] flex-col border-l border-line bg-bg text-ink shadow-[-24px_0_80px_rgba(0,0,0,0.18)]">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.04em] text-accent uppercase">Suggestions</p>
          <h2 className="text-[22px] font-semibold tracking-tight">{feedback ? "How was it?" : "Find a place"}</h2>
        </div>
        <button type="button" aria-label="Close suggestions" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-line">
          <X size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
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
        ) : step < 3 ? (
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
        ) : (
          <CardStep
            place={place}
            spent={index >= places.length}
            empty={status === "empty"}
            routing={status === "routing"}
            error={error}
            stars={stars}
            budget={Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null}
            onNo={() => place && choose(place, false)}
            onYes={() => place && void choose(place, true)}
            onRestart={() => {
              setStep(0);
              setPlaces([]);
              setIndex(0);
              setStatus("idle");
            }}
          />
        )}
      </div>
    </aside>
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
  onNo,
  onYes,
  onRestart,
}: {
  place: ScoredPlace | undefined;
  spent: boolean;
  empty: boolean;
  routing: boolean;
  error: string | null;
  stars: number;
  budget: number | null;
  onNo: () => void;
  onYes: () => void;
  onRestart: () => void;
}) {
  if (empty || spent || !place) {
    return (
      <div className="pt-8">
        <h3 className="text-[28px] font-semibold tracking-tight">{empty ? "Nothing nearby matched." : "That's every suggestion."}</h3>
        <p className="mt-2 text-[15px] text-muted">Try a different place, rating, or budget.</p>
        <Button className="mt-6" size="md" onClick={onRestart}>
          Ask again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] text-muted">Swipe right for yes, left for no.</p>
      <SwipeCard place={place} stars={stars} budget={budget} onNo={onNo} onYes={onYes} />
      {error ? <p className="mt-3 text-[14px] text-danger">{error}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="md" onClick={onNo} disabled={routing}>
          No
        </Button>
        <Button size="md" onClick={onYes} disabled={routing}>
          {routing ? "Matching..." : "Yes"}
        </Button>
      </div>
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
      <img src={place.image ?? fallbackImage(place.category)} alt="" className="h-52 w-full object-cover" />
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
