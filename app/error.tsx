"use client";

import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="content" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5">
      <h1 className="text-[40px] font-semibold tracking-tight">Something went wrong.</h1>
      <p className="mt-3 text-[18px] text-muted">Try again, or start a new session.</p>
      <Button className="mt-8 w-fit" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
