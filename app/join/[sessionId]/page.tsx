import type { Metadata } from "next";
import { JoinSession } from "@/components/session/JoinSession";
import { isSessionId } from "@/lib/session/ids";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Join",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isSessionId(sessionId)) {
    return (
      <main id="content" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5">
        <h1 className="text-[40px] font-semibold tracking-tight">This session doesn’t exist.</h1>
        <ButtonLink href="/create" className="mt-8 w-fit">
          Create a session
        </ButtonLink>
      </main>
    );
  }
  return <JoinSession sessionId={sessionId} />;
}
