import type { Metadata } from "next";
import { SessionScreen } from "@/components/session/SessionScreen";

export const metadata: Metadata = {
  title: "Map",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionScreen sessionId={sessionId} />;
}
