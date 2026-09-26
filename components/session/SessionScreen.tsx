"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { LocateFixed, Maximize2, Minus, Plus } from "lucide-react";
import Confetti from "react-confetti";
import type { LiveMapHandle, MapPerson, MapPlace } from "@/components/map/LiveMap";
import { BottomSheet } from "@/components/session/BottomSheet";
import { JoinForm } from "@/components/session/JoinForm";
import { SessionPanel, type PersonRow } from "@/components/session/SessionPanel";
import { LocationConsent, LocationProblem, SessionEnded } from "@/components/session/SessionStates";
import { Appear } from "@/components/motion/Appear";
import { MeetDrawer } from "@/components/meeting/MeetDrawer";
import { MacStage } from "@/components/layout/MacStage";
import { useLocation } from "@/hooks/useLocation";
import { useSession } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { assignAvatars } from "@/lib/avatars";
import { calculateDistance } from "@/lib/distance/haversine";
import { formatDistance } from "@/lib/distance/format";
import { summarizeGroup } from "@/lib/distance/group";
import { repository } from "@/lib/data/repository";
import { parseMeetPlan, type MeetPath, type MeetPlan } from "@/lib/meeting/plan";
import { isSessionId, shareUrl } from "@/lib/session/ids";
import { ButtonLink } from "@/components/ui/Button";

const LiveMap = dynamic(() => import("@/components/map/LiveMap").then((mod) => mod.LiveMap), {
  ssr: false,
});

const SHARE_EVENT = "nearme-share";
const shareKey = (id: string) => `nearme.share.${id}`;

function subscribeShare(onChange: () => void) {
  window.addEventListener(SHARE_EVENT, onChange);
  return () => window.removeEventListener(SHARE_EVENT, onChange);
}

function readShare(sessionId: string) {
  const saved = window.sessionStorage.getItem(shareKey(sessionId));
  return saved === "yes" || saved === "no" ? saved : "unknown";
}

function writeShare(sessionId: string, value: "yes" | "no") {
  window.sessionStorage.setItem(shareKey(sessionId), value);
  window.dispatchEvent(new Event(SHARE_EVENT));
}

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId);
  const theme = useTheme();
  const mapHandle = useRef<LiveMapHandle | null>(null);
  const shareChoice = useSyncExternalStore(
    subscribeShare,
    () => readShare(sessionId),
    () => "unknown" as const,
  );
  const [armWatch, setArmWatch] = useState(false);
  const [stoppedNote, setStoppedNote] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [routes, setRoutes] = useState<MeetPath[]>([]);
  const [meetOpen, setMeetOpen] = useState(false);
  const [matched, setMatched] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const arrivedPlace = useRef<string | null>(null);
  const [placingTester, setPlacingTester] = useState(false);
  const [testerDrop, setTesterDrop] = useState<{ latitude: number; longitude: number; at: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const location = useLocation(armWatch && !session.ended);
  const lastSent = useRef<{ latitude: number; longitude: number; at: number } | null>(null);
  const onSheetHeight = useCallback((height: number) => setSheetHeight(height), []);

  useEffect(() => {
    if (shareChoice === "yes") setArmWatch(true);
  }, [shareChoice]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const rememberPlan = useCallback((plan: MeetPlan) => {
    setPlace(plan.place);
    setRoutes(plan.paths);
    setMatched(true);
    window.sessionStorage.setItem(`nearme.meet.${sessionId}`, JSON.stringify(plan));
  }, [sessionId]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(`nearme.meet.${sessionId}`);
      if (!saved) return;
      const plan = parseMeetPlan(JSON.parse(saved));
      if (!plan) return;
      setPlace(plan.place);
      setRoutes(plan.paths);
      setMatched(true);
    } catch {
      window.sessionStorage.removeItem(`nearme.meet.${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    return repository.subscribeMeet(sessionId, rememberPlan);
  }, [rememberPlan, sessionId]);

  useEffect(() => {
    if (!matched || !place || !location.position) return;
    if (arrivedPlace.current === place.id) return;
    const meters = calculateDistance(
      location.position.latitude,
      location.position.longitude,
      place.latitude,
      place.longitude,
    );
    if (meters > 120) return;
    arrivedPlace.current = place.id;
    setCelebrated(true);
    setFeedbackOpen(true);
    setMeetOpen(true);
  }, [location.position, matched, place]);

  useEffect(() => {
    if (!celebrated) return;
    const timer = window.setTimeout(() => setCelebrated(false), 4500);
    return () => window.clearTimeout(timer);
  }, [celebrated]);

  useEffect(() => {
    if (!session.isMember || session.ended) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void repository.heartbeat(sessionId).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [session.ended, session.isMember, sessionId]);

  useEffect(() => {
    if (!armWatch || !location.position || session.ended) return;
    const fix = location.position;
    const previous = lastSent.current;
    const moved = previous
      ? calculateDistance(previous.latitude, previous.longitude, fix.latitude, fix.longitude)
      : Number.POSITIVE_INFINITY;
    const elapsed = previous ? Date.now() - previous.at : Number.POSITIVE_INFINITY;
    if (elapsed < 3000) return;
    if (moved < 12 && elapsed < 15000) return;
    lastSent.current = { latitude: fix.latitude, longitude: fix.longitude, at: Date.now() };
    void repository
      .updateLocation(sessionId, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
      })
      .catch(() => {});
  }, [armWatch, location.position, session.ended, sessionId]);

  const snapshot = session.snapshot;
  const participants = snapshot?.participants ?? [];
  const selfId = snapshot?.selfId ?? (participants.length === 1 ? participants[0]?.id : null);
  const avatarById = assignAvatars(participants.map((person) => person.id));
  const locationById = useMemo(() => {
    const entries = new Map((snapshot?.locations ?? []).map((item) => [item.participantId, item]));
    return entries;
  }, [snapshot?.locations]);

  const located = participants.flatMap((person) => {
    const remote = locationById.get(person.id);
    const local =
      person.id === selfId && armWatch && location.position
        ? {
            latitude: location.position.latitude,
            longitude: location.position.longitude,
            accuracy: location.position.accuracy,
            timestamp: new Date(location.position.timestamp).toISOString(),
          }
        : null;
    const point = local ?? remote;
    if (!point) return [];
    const age = now - Date.parse(point.timestamp);
    const fresh = age <= 90_000;
    const selfOnMap = person.id === selfId && armWatch && !location.error && Boolean(local);
    const live = person.id === selfId ? selfOnMap || (person.sharing && fresh) : person.sharing && fresh;
    const paused = !live && person.sharing && age <= 3 * 60_000;
    if (!live && !paused) return [];
    return [
      {
        id: person.id,
        name: person.displayName,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        avatar: avatarById.get(person.id) ?? "/avatars/01.jpg",
        isSelf: person.id === selfId,
        paused,
      } satisfies MapPerson,
    ];
  });

  const activeSelected = selectedId ?? selfId ?? null;
  const reference = located.find((person) => person.id === activeSelected) ?? located.find((person) => person.isSelf);
  const rows: PersonRow[] = [...participants]
    .sort((left, right) => Number(right.id === selfId) - Number(left.id === selfId))
    .map((person) => {
      const point = located.find((item) => item.id === person.id);
      let subtitle = "Not sharing";
      if (person.id === selfId) {
        subtitle = location.position && location.position.accuracy && location.position.accuracy > 75 ? "You · Approximate" : "You";
      } else if (person.id === activeSelected && point) subtitle = "Selected";
      else if (point?.paused) subtitle = "Location paused";
      else if (point && reference && person.id !== reference.id) {
        subtitle = formatDistance(
          calculateDistance(reference.latitude, reference.longitude, point.latitude, point.longitude),
        );
      } else if (!person.sharing) subtitle = "Not sharing";
      else subtitle = "Location paused";
      return {
        id: person.id,
        name: person.displayName,
        subtitle,
        isYou: person.id === selfId,
        avatar: avatarById.get(person.id) ?? "/avatars/01.jpg",
      };
    });

  const group = summarizeGroup(
    located.filter((person) => !person.paused).map((person) => ({
      id: person.id,
      name: person.name,
      latitude: person.latitude,
      longitude: person.longitude,
    })),
    reference?.id ?? "",
  );

  function chooseShare() {
    location.prime();
    writeShare(sessionId, "yes");
    setStoppedNote(false);
    setArmWatch(true);
  }

  async function chooseStop() {
    setArmWatch(false);
    writeShare(sessionId, "no");
    setStoppedNote(true);
    await repository.stopSharing(sessionId);
  }

  if (!isSessionId(sessionId) || session.phase === "missing") {
    return (
      <MacStage>
        <h1 className="text-[28px] font-semibold tracking-tight">This session doesn’t exist.</h1>
        <ButtonLink href="/create" size="sm" pill className="mt-6">
          Create a session
        </ButtonLink>
      </MacStage>
    );
  }

  if (session.phase === "error" && !snapshot) {
    return (
      <MacStage>
        <h1 className="text-[28px] font-semibold tracking-tight">Something went wrong.</h1>
        <p className="mt-2 text-[15px] text-[#6e6e73]">{session.error}</p>
      </MacStage>
    );
  }

  if (session.ended) return <SessionEnded />;

  if (session.phase === "loading" && !session.isMember) {
    return (
      <MacStage>
        <p className="text-[22px] font-semibold tracking-tight">Finding the session...</p>
      </MacStage>
    );
  }

  if (!session.isMember) {
    return (
      <MacStage>
        <JoinForm sessionId={sessionId} join={session.join} onJoined={() => undefined} embedded />
      </MacStage>
    );
  }

  if (session.phase === "loading" && !snapshot) {
    return (
      <MacStage>
        <p className="text-[22px] font-semibold tracking-tight">Finding everyone...</p>
      </MacStage>
    );
  }

  if (shareChoice === "unknown") {
    return (
      <LocationConsent
        onShare={chooseShare}
        onLater={() => {
          writeShare(sessionId, "no");
        }}
      />
    );
  }

  const waitingForFix = armWatch && !location.position && !location.error;
  const sharingOn = armWatch && Boolean(location.position) && !location.error;
  const statusLabel = waitingForFix
    ? "Finding you on the map..."
    : sharingOn
      ? "Location sharing is on"
      : "Location sharing is paused";
  const notice = stoppedNote
    ? "Your location is no longer being shared."
    : waitingForFix
      ? "Finding you on the map..."
      : !sharingOn
        ? "Share your location so everyone can see you."
        : null;
  const link = shareUrl(sessionId);
  const panel = (
    <SessionPanel
      count={snapshot?.participantCount ?? participants.length}
      referenceLabel={reference && !reference.isSelf ? `Distances from ${reference.name}` : null}
      rows={rows}
      selectedId={activeSelected}
      onSelect={(id) => {
        setSelectedId(id);
        mapHandle.current?.focus(id);
      }}
      summary={located.filter((person) => !person.paused).length > 1 ? group.headline : null}
      detail={group.detail}
      empty={(snapshot?.participantCount ?? 1) <= 1}
      shareUrl={link}
      notice={notice}
      sharing={sharingOn}
      onShare={chooseShare}
      onStop={() => void chooseStop()}
      isCreator={Boolean(snapshot?.isCreator)}
      onEnd={async () => {
        await session.endSession();
        await session.refresh();
      }}
      onOpenMeet={() => setMeetOpen(true)}
      sessionId={sessionId}
      placingTester={placingTester}
      testerDrop={testerDrop}
      onPlacingTester={setPlacingTester}
    />
  );

  return (
    <div className="nm-map relative h-dvh overflow-hidden bg-surface" style={{ "--nm-sheet": `${sheetHeight}px` } as CSSProperties}>
      <LiveMap
        people={located}
        selectedId={activeSelected}
        place={place}
        routes={routes}
        routeColor={matched ? "#248a3d" : "#0071e3"}
        theme={theme}
        sheetHeight={sheetHeight}
        mapRef={mapHandle}
        placing={placingTester}
        onMapClick={
          placingTester
            ? (latitude, longitude) => setTesterDrop({ latitude, longitude, at: Date.now() })
            : undefined
        }
        onSelect={(id) => {
          setSelectedId(id);
          mapHandle.current?.focus(id);
        }}
      />
      <Appear className="absolute inset-x-0 top-0 z-20" y={-10} delay={0.05}>
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-5">
        <Link href="/" className="glass rounded-xl border border-line px-3 py-2 text-[15px] font-semibold tracking-tight">
          Near Me
        </Link>
        <p className="glass rounded-full border border-line px-3 py-1.5 text-[13px]" role="status">
          {statusLabel}
        </p>
      </header>
      </Appear>
      {location.error === "denied" ? (
        <LocationProblem
          title="Location access is turned off."
          body="Allow location for this site. On Android, use Chrome. On iPhone, use Safari. If you opened the link inside another app, open it in the browser first."
          action="Try again"
          onAction={() => {
            location.prime();
            setArmWatch(true);
            location.retry();
          }}
        />
      ) : null}
      {location.error === "unavailable" ? (
        <LocationProblem
          title="We couldn't determine your location."
          body="Turn location on for this browser, then try again. On Android use Chrome. On iPhone use Safari."
          action="Try again"
          onAction={() => {
            location.prime();
            location.retry();
          }}
        />
      ) : null}
      {location.error === "timeout" ? (
        <LocationProblem
          title="This is taking longer than expected."
          body="The phone is still looking. Stay on this page with location allowed. On Android, open the link in Chrome. On iPhone, open it in Safari."
          action="Try again"
          onAction={() => {
            location.prime();
            location.retry();
          }}
        />
      ) : null}
      {location.error === "unsupported" ? (
        <LocationProblem
          title="This browser can't share your location."
          body="Open this link in Chrome on Android or Safari on iPhone. Location does not work inside some other apps."
        />
      ) : null}
      <Appear className="absolute top-20 bottom-6 left-4 z-20 hidden w-[320px] md:block" delay={0.12}>
      <aside className="glass h-full overflow-y-auto rounded-2xl border border-line p-5">
        {panel}
      </aside>
      </Appear>
      <div className="nm-controls">
        <MapButton label="Zoom in" onClick={() => mapHandle.current?.zoomIn()}>
          <Plus size={18} strokeWidth={1.75} />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => mapHandle.current?.zoomOut()}>
          <Minus size={18} strokeWidth={1.75} />
        </MapButton>
        <MapButton label="Fit everyone" onClick={() => mapHandle.current?.fitEveryone()}>
          <Maximize2 size={18} strokeWidth={1.75} />
        </MapButton>
        <MapButton label="My location" onClick={() => mapHandle.current?.focusSelf()}>
          <LocateFixed size={18} strokeWidth={1.75} />
        </MapButton>
      </div>
      {celebrated ? (
        <Confetti
          width={viewport.width}
          height={viewport.height}
          recycle={false}
          numberOfPieces={420}
          gravity={0.18}
          style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none" }}
        />
      ) : null}
      <MeetDrawer
        open={meetOpen}
        people={located.filter((person) => !person.paused)}
        feedback={feedbackOpen}
        matchedName={place?.name ?? null}
        sessionId={sessionId}
        voterName={participants.find((person) => person.id === selfId)?.displayName ?? "You"}
        onClose={() => {
          setMeetOpen(false);
          if (feedbackOpen) setFeedbackOpen(false);
        }}
        onMatch={(plan) => {
          rememberPlan(plan);
          arrivedPlace.current = null;
          void repository.publishMeet(sessionId, plan);
        }}
        onFeedback={() => undefined}
      />
      <BottomSheet
        onHeight={onSheetHeight}
        summary={
          <span>
            <span className="block text-[15px] font-medium">
              {snapshot?.participantCount ?? 0} {(snapshot?.participantCount ?? 0) === 1 ? "person" : "people"}
            </span>
            <span className="block truncate text-[13px] text-muted">
              {participants.map((person) => person.displayName).join(", ")}
            </span>
          </span>
        }
      >
        {panel}
      </BottomSheet>
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="glass inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink"
    >
      {children}
    </button>
  );
}
