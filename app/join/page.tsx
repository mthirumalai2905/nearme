import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JoinEntry } from "@/components/session/JoinForm";

export const metadata: Metadata = {
  title: "Join a session",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-xl flex-col justify-center px-5 py-16">
        <div className="nm-panel p-6 sm:p-8">
        <p className="text-[13px] font-semibold tracking-[0.04em] text-accent uppercase">Join</p>
        <h1 className="mt-3 text-[40px] leading-tight font-semibold tracking-tight">Join a session</h1>
        <p className="mt-3 text-[18px] text-muted">Paste the link a friend sent you.</p>
        <JoinEntry />
        </div>
      </main>
    </>
  );
}
