import { MacStage } from "@/components/layout/MacStage";
import { Button } from "@/components/ui/Button";

export function LocationConsent({
  onShare,
  onLater,
}: {
  onShare: () => void;
  onLater: () => void;
}) {
  return (
    <main id="content" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-16">
      <p className="text-[15px] font-semibold tracking-tight">Near Me</p>
      <h1 className="mt-8 text-[40px] leading-tight font-semibold tracking-tight">Share your location</h1>
      <p className="mt-4 text-[18px] leading-relaxed text-muted">
        See everyone on the map and know how far apart you are. Your location is shared only while this session is
        active.
      </p>
      <p className="mt-4 text-[16px] leading-relaxed text-muted">
        Allow Near Me to use your location so everyone can see you on the map.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onShare}>Share location</Button>
        <Button variant="secondary" onClick={onLater}>
          Not now
        </Button>
      </div>
    </main>
  );
}

export function SessionEnded({ detail }: { detail?: string }) {
  return (
    <MacStage>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Session ended</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">{detail ?? "Your location is no longer being shared."}</p>
      <a
        href="/create"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0071e3] px-5 text-[15px] font-medium text-white hover:bg-[#0077ed]"
      >
        Create a session
      </a>
    </MacStage>
  );
}

export function LocationProblem({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="glass absolute inset-x-4 top-20 z-30 max-w-md rounded-2xl border border-line p-5 md:left-5" role="alert">
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
      {action && onAction ? (
        <Button className="mt-4" size="md" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
