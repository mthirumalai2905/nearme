import type { Metadata } from "next";
import { CreateSession } from "@/components/session/CreateSession";

export const metadata: Metadata = {
  title: "Create a session",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CreateSession />;
}
