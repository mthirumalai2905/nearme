import type { Metadata } from "next";
import { MacStage } from "@/components/layout/MacStage";
import { JoinEntry } from "@/components/session/JoinForm";

export const metadata: Metadata = {
  title: "Join a session",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <MacStage>
      <p className="text-[13px] font-semibold tracking-[0.04em] text-[#0071e3] uppercase">Join</p>
      <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight">Join a session</h1>
      <p className="mt-1.5 text-[15px] text-[#6e6e73]">Paste the link a friend sent you.</p>
      <JoinEntry embedded />
    </MacStage>
  );
}
